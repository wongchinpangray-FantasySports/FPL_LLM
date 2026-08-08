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
    return (
        s.lower()
        .replace(".", "")
        .replace("-", " ")
        .replace("'", "")
        .strip()
    )


def _fuzzy_match_xg(supabase) -> int:
    """Populate ``understat_xg.matched_fpl_id`` where NULL."""
    players = (
        supabase.table("players_static")
        .select("fpl_id,name,web_name,team")
        .execute()
        .data
        or []
    )
    unmatched = (
        supabase.table("understat_xg")
        .select("id,player_name,team")
        .is_("matched_fpl_id", None)
        .limit(5000)
        .execute()
        .data
        or []
    )
    if not unmatched:
        return 0

    choices: Dict[str, int] = {}
    for p in players:
        choices[_normalize(f"{p['name']}")] = p["fpl_id"]
        if p.get("web_name"):
            choices[_normalize(p["web_name"])] = p["fpl_id"]

    updates: List[Dict[str, Any]] = []
    keys = list(choices.keys())
    for row in unmatched:
        target = _normalize(row.get("player_name") or "")
        if not target:
            continue
        best = process.extractOne(target, keys, scorer=fuzz.WRatio)
        if not best:
            continue
        name, score, _ = best
        if score < 85:
            continue
        updates.append({"id": row["id"], "matched_fpl_id": choices[name]})

    for u in updates:
        supabase.table("understat_xg").update(
            {"matched_fpl_id": u["matched_fpl_id"]}
        ).eq("id", u["id"]).execute()

    return len(updates)


def _match_shots_from_xg(supabase) -> int:
    """Copy FPL ids onto shots via understat player id → understat_xg matches."""
    mapped = (
        supabase.table("understat_xg")
        .select("understat_id,matched_fpl_id")
        .not_.is_("matched_fpl_id", "null")
        .limit(10000)
        .execute()
        .data
        or []
    )
    by_us: Dict[str, int] = {}
    for row in mapped:
        uid = str(row.get("understat_id") or "")
        fid = row.get("matched_fpl_id")
        if uid and fid is not None:
            by_us[uid] = int(fid)
    if not by_us:
        return 0

    unmatched = (
        supabase.table("understat_shots")
        .select("id,understat_player_id")
        .is_("matched_fpl_id", None)
        .limit(8000)
        .execute()
        .data
        or []
    )
    n = 0
    for row in unmatched:
        uid = str(row.get("understat_player_id") or "")
        fid = by_us.get(uid)
        if fid is None:
            continue
        supabase.table("understat_shots").update(
            {"matched_fpl_id": fid}
        ).eq("id", row["id"]).execute()
        n += 1
    return n


def _fuzzy_match_shots(supabase) -> int:
    """Fallback name fuzzy-match for remaining unmatched shots."""
    players = (
        supabase.table("players_static")
        .select("fpl_id,name,web_name")
        .execute()
        .data
        or []
    )
    unmatched = (
        supabase.table("understat_shots")
        .select("id,player_name")
        .is_("matched_fpl_id", None)
        .limit(5000)
        .execute()
        .data
        or []
    )
    if not unmatched:
        return 0

    choices: Dict[str, int] = {}
    for p in players:
        choices[_normalize(f"{p['name']}")] = p["fpl_id"]
        if p.get("web_name"):
            choices[_normalize(p["web_name"])] = p["fpl_id"]
    keys = list(choices.keys())
    n = 0
    for row in unmatched:
        target = _normalize(row.get("player_name") or "")
        if not target:
            continue
        best = process.extractOne(target, keys, scorer=fuzz.WRatio)
        if not best or best[1] < 88:
            continue
        supabase.table("understat_shots").update(
            {"matched_fpl_id": choices[best[0]]}
        ).eq("id", row["id"]).execute()
        n += 1
    return n


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

    print("Fuzzy-matching understat_xg → players_static...")
    matched = _fuzzy_match_xg(supabase)
    print(f"  matched {matched} new xG rows.")

    print("Matching understat_shots → FPL ids...")
    try:
        n1 = _match_shots_from_xg(supabase)
        n2 = _fuzzy_match_shots(supabase)
        print(f"  matched {n1} via understat id, {n2} via name.")
    except Exception as exc:
        print(f"  shot matching skipped: {exc}", file=sys.stderr)

    print("Done.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--season", type=int, required=True, help="e.g. 2025")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()
    try:
        fetch_and_sync(season=args.season, limit=args.limit)
    except Exception as exc:
        print(f"sync_understat failed: {exc}", file=sys.stderr)
        raise


if __name__ == "__main__":
    main()
