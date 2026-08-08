"""Scrape per-match player xG / xA and shot maps from Understat into Supabase.

Understat now serves data via AJAX JSON endpoints (HTML no longer embeds
``shotsData`` / ``rostersData``):

- ``GET /getLeagueData/EPL/{season}`` → dates, players, teams
- ``GET /getMatchData/{match_id}`` → rosters, shots, tmpl

After insert we fuzzy-match player names → ``players_static.fpl_id`` and also
propagate matches onto ``understat_shots.matched_fpl_id``.

Run: ``python -m data_sync.sync_understat --season 2026``
"""

from __future__ import annotations

import argparse
import sys
import time
import unicodedata
from datetime import date
from typing import Any, Dict, List, Optional, Tuple

import requests
from rapidfuzz import fuzz, process

from .common import get_supabase_client, upsert_batch

LEAGUE_API = "https://understat.com/getLeagueData/EPL/{season}"
MATCH_API = "https://understat.com/getMatchData/{match_id}"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0 Safari/537.36"
    ),
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "en-GB,en;q=0.9",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": "https://understat.com/",
}


def _get_json(url: str) -> Any:
    resp = requests.get(url, headers=HEADERS, timeout=45)
    resp.raise_for_status()
    return resp.json()


def _list_matches(season: int) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    data = _get_json(LEAGUE_API.format(season=season))
    matches = data.get("dates") or data.get("datesData") or []
    players = data.get("players") or data.get("playersData") or []
    return matches, players


def _match_payload(match_id: str) -> Dict[str, Any]:
    try:
        return _get_json(MATCH_API.format(match_id=match_id))
    except Exception:
        return {}


def _build_roster_rows(
    match: Dict[str, Any],
    rosters: Dict[str, Any],
    season: str,
) -> List[Dict[str, Any]]:
    match_date = (match.get("datetime") or "")[:10] or None
    rows: List[Dict[str, Any]] = []
    for side in ("h", "a"):
        side_data = rosters.get(side, {}) or {}
        for _pid, entry in side_data.items():
            if not isinstance(entry, dict):
                continue
            rows.append(
                {
                    "understat_id": str(entry.get("player_id") or ""),
                    "player_name": entry.get("player"),
                    "team": (match.get(side, {}) or {}).get("title"),
                    "season": season,
                    "gw": None,
                    "match_date": match_date,
                    "minutes": int(float(entry.get("time") or 0)),
                    "goals": int(float(entry.get("goals") or 0)),
                    "assists": int(float(entry.get("assists") or 0)),
                    "shots": int(float(entry.get("shots") or 0)),
                    "key_passes": int(float(entry.get("key_passes") or 0)),
                    "xg": float(entry.get("xG") or 0),
                    "xa": float(entry.get("xA") or 0),
                    "npg": int(float(entry.get("npg") or 0)),
                    "npxg": float(entry.get("npxG") or 0),
                }
            )
    return rows


def _build_shot_rows(
    match: Dict[str, Any],
    shots: Dict[str, Any],
    season: str,
) -> List[Dict[str, Any]]:
    match_id = str(match.get("id") or "")
    match_date = (match.get("datetime") or "")[:10] or None
    home = (match.get("h", {}) or {}).get("title")
    away = (match.get("a", {}) or {}).get("title")
    rows: List[Dict[str, Any]] = []

    for side in ("h", "a"):
        for shot in shots.get(side, []) or []:
            if not isinstance(shot, dict):
                continue
            shot_id = str(shot.get("id") or "")
            if not shot_id:
                continue
            try:
                x = float(shot.get("X") or 0)
                y = float(shot.get("Y") or 0)
            except (TypeError, ValueError):
                continue
            if not (0 <= x <= 1 and 0 <= y <= 1):
                continue

            h_a = shot.get("h_a") or side
            team = shot.get("h_team") if h_a == "h" else shot.get("a_team")
            opponent = shot.get("a_team") if h_a == "h" else shot.get("h_team")
            if not team:
                team = home if side == "h" else away
            if not opponent:
                opponent = away if side == "h" else home

            date_raw = (shot.get("date") or "")[:10]
            rows.append(
                {
                    "understat_shot_id": shot_id,
                    "understat_player_id": str(shot.get("player_id") or "") or None,
                    "player_name": shot.get("player") or "Unknown",
                    "team": team,
                    "opponent": opponent,
                    "season": season,
                    "match_id": str(shot.get("match_id") or match_id),
                    "match_date": date_raw or match_date,
                    "minute": int(float(shot.get("minute") or 0)),
                    "x": round(x, 4),
                    "y": round(y, 4),
                    "xg": float(shot.get("xG") or 0),
                    "result": shot.get("result"),
                    "shot_type": shot.get("shotType"),
                    "situation": shot.get("situation"),
                    "h_a": h_a if h_a in ("h", "a") else side,
                }
            )
    return rows


def _normalize(s: str) -> str:
    # Understat occasionally stores HTML entities in names.
    raw = (
        s.replace("&#039;", "'")
        .replace("&apos;", "'")
        .replace("&amp;", "&")
        .replace("&quot;", '"')
    )
    # Fold accents so "João"/"Ødegaard" match FPL spellings.
    folded = "".join(
        c
        for c in unicodedata.normalize("NFKD", raw)
        if not unicodedata.combining(c)
    )
    folded = (
        folded.replace("ø", "o")
        .replace("Ø", "O")
        .replace("æ", "ae")
        .replace("Æ", "AE")
        .replace("ð", "d")
        .replace("Ð", "D")
        .replace("þ", "th")
        .replace("Þ", "Th")
        .replace("ł", "l")
        .replace("Ł", "L")
    )
    return (
        folded.lower()
        .replace(".", "")
        .replace("-", " ")
        .replace("'", "")
        .strip()
    )


def _name_tokens(s: str) -> List[str]:
    return [t for t in _normalize(s).split() if t]


def _names_compatible(understat_name: str, fpl_name: str) -> bool:
    """Reject João Pedro ↔ João Palhinha style collisions on shared first names."""
    a = _name_tokens(understat_name)
    b = set(_name_tokens(fpl_name))
    if not a or not b:
        return False
    if len(a) == 1:
        return a[0] in b
    # Understat surname (last token) must appear somewhere in the FPL name.
    return a[-1] in b


def _best_fpl_name(
    target_name: str,
    choices: Dict[str, int],
    keys: List[str],
    *,
    min_score: int,
) -> Optional[int]:
    target = _normalize(target_name)
    if not target:
        return None
    tokens = _name_tokens(target_name)
    pool = keys
    if len(tokens) >= 2:
        last = tokens[-1]
        narrowed = [k for k in keys if last in _name_tokens(k)]
        if narrowed:
            pool = narrowed
    best = process.extractOne(target, pool, scorer=fuzz.WRatio)
    if not best or best[1] < min_score:
        return None
    if not _names_compatible(target_name, best[0]):
        return None
    return choices[best[0]]


def _fpl_label(p: Dict[str, Any]) -> str:
    return " ".join(
        x for x in (str(p.get("name") or ""), str(p.get("web_name") or "")) if x
    )


def _fetch_all(
    query_factory,
    *,
    page_size: int = 1000,
) -> List[Dict[str, Any]]:
    """Paginate a PostgREST select until exhausted."""
    out: List[Dict[str, Any]] = []
    start = 0
    while True:
        end = start + page_size - 1
        rows = query_factory().range(start, end).execute().data or []
        out.extend(rows)
        if len(rows) < page_size:
            break
        start += page_size
    return out


def _fpl_name_choices(supabase) -> Dict[str, int]:
    players = (
        supabase.table("players_static")
        .select("fpl_id,name,web_name")
        .execute()
        .data
        or []
    )
    choices: Dict[str, int] = {}
    for p in players:
        choices[_normalize(str(p.get("name") or ""))] = int(p["fpl_id"])
        if p.get("web_name"):
            choices[_normalize(str(p["web_name"]))] = int(p["fpl_id"])
    # Drop empty keys from blank names.
    choices.pop("", None)
    return choices


def _understat_id_to_fpl(supabase) -> Dict[str, int]:
    """Map Understat player id → FPL id from any already-matched xG/shot row."""
    by_us: Dict[str, int] = {}
    mapped_xg = _fetch_all(
        lambda: supabase.table("understat_xg")
        .select("understat_id,matched_fpl_id")
        .not_.is_("matched_fpl_id", "null")
    )
    for row in mapped_xg:
        uid = str(row.get("understat_id") or "")
        fid = row.get("matched_fpl_id")
        if uid and fid is not None:
            by_us[uid] = int(fid)

    mapped_shots = _fetch_all(
        lambda: supabase.table("understat_shots")
        .select("understat_player_id,matched_fpl_id")
        .not_.is_("matched_fpl_id", "null")
        .not_.is_("understat_player_id", "null")
    )
    for row in mapped_shots:
        uid = str(row.get("understat_player_id") or "")
        fid = row.get("matched_fpl_id")
        if uid and fid is not None and uid not in by_us:
            by_us[uid] = int(fid)
    return by_us


def _propagate_xg_matches(supabase, by_us: Dict[str, int]) -> int:
    """Fill NULL matched_fpl_id on understat_xg using known understat_id → FPL map."""
    if not by_us:
        return 0
    n = 0
    for uid, fid in by_us.items():
        resp = (
            supabase.table("understat_xg")
            .update({"matched_fpl_id": fid})
            .eq("understat_id", uid)
            .is_("matched_fpl_id", None)
            .execute()
        )
        n += len(resp.data or [])
    return n


def _fuzzy_match_xg(supabase) -> int:
    """Populate ``understat_xg.matched_fpl_id`` where NULL (name fuzzy, bulk)."""
    choices = _fpl_name_choices(supabase)
    if not choices:
        return 0
    keys = list(choices.keys())

    # Distinct understat players still unmatched — not every match row.
    unmatched = _fetch_all(
        lambda: supabase.table("understat_xg")
        .select("understat_id,player_name")
        .is_("matched_fpl_id", None)
    )
    by_name: Dict[str, str] = {}
    for row in unmatched:
        uid = str(row.get("understat_id") or "")
        if not uid or uid in by_name:
            continue
        by_name[uid] = row.get("player_name") or ""

    uid_to_fpl: Dict[str, int] = {}
    for uid, pname in by_name.items():
        fid = _best_fpl_name(pname, choices, keys, min_score=85)
        if fid is None:
            continue
        uid_to_fpl[uid] = fid

    n = 0
    for uid, fid in uid_to_fpl.items():
        resp = (
            supabase.table("understat_xg")
            .update({"matched_fpl_id": fid})
            .eq("understat_id", uid)
            .is_("matched_fpl_id", None)
            .execute()
        )
        n += len(resp.data or []) or 1
    return n


def _match_shots_from_xg(supabase, by_us: Optional[Dict[str, int]] = None) -> int:
    """Copy FPL ids onto shots via understat player id (bulk per id)."""
    mapping = by_us if by_us is not None else _understat_id_to_fpl(supabase)
    if not mapping:
        return 0

    n = 0
    for i, (uid, fid) in enumerate(mapping.items(), 1):
        (
            supabase.table("understat_shots")
            .update({"matched_fpl_id": fid})
            .eq("understat_player_id", uid)
            .is_("matched_fpl_id", None)
            .execute()
        )
        n += 1
        if i % 100 == 0:
            print(f"    shot id-match progress {i}/{len(mapping)}", flush=True)
    return n


def _fuzzy_match_shots(supabase) -> int:
    """Fallback name fuzzy-match for remaining unmatched shots (bulk by uid)."""
    choices = _fpl_name_choices(supabase)
    if not choices:
        return 0
    keys = list(choices.keys())

    unmatched = _fetch_all(
        lambda: supabase.table("understat_shots")
        .select("understat_player_id,player_name")
        .is_("matched_fpl_id", None)
        .not_.is_("understat_player_id", "null")
    )

    by_uid: Dict[str, str] = {}
    for row in unmatched:
        uid = str(row.get("understat_player_id") or "")
        if not uid or uid in by_uid:
            continue
        by_uid[uid] = row.get("player_name") or ""

    uid_to_fpl: Dict[str, int] = {}
    for uid, pname in by_uid.items():
        fid = _best_fpl_name(pname, choices, keys, min_score=88)
        if fid is None:
            continue
        uid_to_fpl[uid] = fid

    n = 0
    for uid, fid in uid_to_fpl.items():
        (
            supabase.table("understat_shots")
            .update({"matched_fpl_id": fid})
            .eq("understat_player_id", uid)
            .is_("matched_fpl_id", None)
            .execute()
        )
        n += 1
    return n


def _repair_incompatible_matches(supabase) -> int:
    """Unlink / reassign matches where last names clearly disagree (e.g. Pedro↔Palhinha)."""
    players = (
        supabase.table("players_static")
        .select("fpl_id,name,web_name")
        .execute()
        .data
        or []
    )
    by_fpl: Dict[int, Dict[str, Any]] = {
        int(p["fpl_id"]): p for p in players if p.get("fpl_id") is not None
    }
    choices = _fpl_name_choices(supabase)
    keys = list(choices.keys())

    shot_pairs = _fetch_all(
        lambda: supabase.table("understat_shots")
        .select("understat_player_id,player_name,matched_fpl_id")
        .not_.is_("matched_fpl_id", "null")
        .not_.is_("understat_player_id", "null")
    )
    seen: Dict[str, Tuple[str, int]] = {}
    for row in shot_pairs:
        uid = str(row.get("understat_player_id") or "")
        if not uid or uid in seen:
            continue
        seen[uid] = (row.get("player_name") or "", int(row["matched_fpl_id"]))

    fixed = 0
    for uid, (pname, fid) in seen.items():
        p = by_fpl.get(fid)
        if not p:
            continue
        ok = _names_compatible(pname, _fpl_label(p))
        if ok:
            continue
        new_fid = _best_fpl_name(pname, choices, keys, min_score=85)
        # Only rewrite when we have a concrete better target — avoid blanking
        # valid links we cannot confidently re-resolve (accents, mononyms).
        if new_fid is None or new_fid == fid:
            continue
        supabase.table("understat_shots").update({"matched_fpl_id": new_fid}).eq(
            "understat_player_id", uid
        ).execute()
        supabase.table("understat_xg").update({"matched_fpl_id": new_fid}).eq(
            "understat_id", uid
        ).execute()
        fixed += 1
        print(
            f"  repaired uid={uid} {pname!r}: fpl {fid} → {new_fid}",
            flush=True,
        )
    return fixed


def rematch_fpl_ids(supabase) -> None:
    """Re-run xG + shot FPL matching without re-scraping Understat."""
    print("Repairing incompatible name matches...", flush=True)
    repaired = _repair_incompatible_matches(supabase)
    print(f"  repaired {repaired} understat player ids.", flush=True)

    print("Building known understat→FPL map from existing matches...", flush=True)
    by_us = _understat_id_to_fpl(supabase)
    print(f"  known understat→FPL ids: {len(by_us)}", flush=True)

    print("Propagating FPL ids onto xG + shots via understat id...", flush=True)
    prop_xg = _propagate_xg_matches(supabase, by_us)
    print(f"  propagated onto xG player-ids (bulk calls): {prop_xg}", flush=True)
    n1 = _match_shots_from_xg(supabase, by_us)
    print(f"  propagated onto shot player-ids: {n1}", flush=True)

    print("Fuzzy-matching remaining understat_xg players by name...", flush=True)
    matched = _fuzzy_match_xg(supabase)
    print(f"  matched {matched} understat players on xG by name.", flush=True)

    by_us = _understat_id_to_fpl(supabase)
    print(f"  known understat→FPL ids now: {len(by_us)}", flush=True)
    n1b = _match_shots_from_xg(supabase, by_us)
    print(f"  shot id-match after xG fuzzy: {n1b}", flush=True)

    print("Fuzzy-matching remaining understat_shots by name...", flush=True)
    try:
        n2 = _fuzzy_match_shots(supabase)
        print(f"  matched {n2} shot player-ids via name.", flush=True)
    except Exception as exc:
        print(f"  shot matching skipped: {exc}", file=sys.stderr)


def fetch_and_sync(
    season: int,
    limit: Optional[int] = None,
    skip_finished_before: Optional[date] = None,
) -> None:
    season_str = f"{season}"
    print(f"Fetching Understat match list for season {season_str}...")
    supabase = get_supabase_client()
    matches, _players = _list_matches(season)
    finished = [m for m in matches if m.get("isResult")]
    if skip_finished_before:
        finished = [
            m
            for m in finished
            if (m.get("datetime") or "")[:10] >= skip_finished_before.isoformat()
        ]
    if limit:
        finished = finished[-limit:]

    print(f"Will scrape {len(finished)} finished matches...")
    all_roster_rows: List[Dict[str, Any]] = []
    all_shot_rows: List[Dict[str, Any]] = []
    for i, m in enumerate(finished, 1):
        mid = str(m.get("id"))
        payload = _match_payload(mid)
        if not payload:
            print(f"  match {mid} empty/failed", file=sys.stderr)
            continue
        rosters = payload.get("rosters") or payload.get("rostersData") or {}
        shots = payload.get("shots") or payload.get("shotsData") or {}
        all_roster_rows.extend(_build_roster_rows(m, rosters, season_str))
        all_shot_rows.extend(_build_shot_rows(m, shots, season_str))
        time.sleep(0.25)
        if i % 20 == 0:
            print(f"  scraped {i}/{len(finished)}")

    print(f"Upserting {len(all_roster_rows)} understat_xg rows...")
    upsert_batch(
        supabase,
        "understat_xg",
        all_roster_rows,
        on_conflict="understat_id,season,match_date",
    )

    print(f"Upserting {len(all_shot_rows)} understat_shots rows...")
    try:
        upsert_batch(
            supabase,
            "understat_shots",
            all_shot_rows,
            on_conflict="understat_shot_id",
        )
    except Exception as exc:
        print(
            f"WARNING: understat_shots upsert failed ({exc}).\n"
            "  Apply supabase/migrations/0027_understat_shots.sql then re-run.",
            file=sys.stderr,
        )

    rematch_fpl_ids(supabase)
    print("Done.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--season",
        type=int,
        default=None,
        help="e.g. 2025 (required unless --rematch-only)",
    )
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument(
        "--rematch-only",
        action="store_true",
        help="Only re-run FPL id matching on existing understat rows",
    )
    args = parser.parse_args()
    try:
        if args.rematch_only:
            rematch_fpl_ids(get_supabase_client())
            print("Done.")
            return
        if args.season is None:
            parser.error("--season is required unless --rematch-only")
        fetch_and_sync(season=args.season, limit=args.limit)
    except Exception as exc:
        print(f"sync_understat failed: {exc}", file=sys.stderr)
        raise


if __name__ == "__main__":
    main()
