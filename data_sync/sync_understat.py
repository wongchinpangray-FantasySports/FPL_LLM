"""Scrape per-match player xG / xA data from Understat into Supabase.

Understat embeds data in JS: ``var <name> = JSON.parse('...')`` inside
``<script>`` tags on the league page. We pull ``playersData`` (season
aggregate) for a sanity check and, more usefully, walk every match on the
league page to get ``rostersData`` (per-match player stats including xG,
xA, shots, key passes).

After insert we fuzzy-match ``player_name`` -> ``players_static.fpl_id``
using rapidfuzz.

Run: ``python -m data_sync.sync_understat --season 2025``
"""

from __future__ import annotations

import argparse
import codecs
import json
import re
import sys
import time
from datetime import date
from typing import Any, Dict, List, Optional, Tuple

import requests
from bs4 import BeautifulSoup
from rapidfuzz import fuzz, process

from .common import get_supabase_client, upsert_batch

LEAGUE_URL = "https://understat.com/league/EPL/{season}"
MATCH_URL = "https://understat.com/match/{match_id}"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0 Safari/537.36"
    ),
    "Accept-Language": "en-GB,en;q=0.9",
}


def _extract_json_var(html: str, var_name: str) -> Any:
    """Extract ``var <name> = JSON.parse('...')`` from an Understat page."""
    pattern = re.compile(
        rf"var\s+{var_name}\s*=\s*JSON\.parse\(\s*'(.*?)'\s*\)",
        re.DOTALL,
    )
    m = pattern.search(html)
    if not m:
        raise ValueError(f"Could not find var {var_name} in page")
    escaped = m.group(1)
    decoded = codecs.decode(escaped, "unicode_escape")
    return json.loads(decoded)


def _list_matches(season: int) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    url = LEAGUE_URL.format(season=season)
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    html = resp.text
    matches = _extract_json_var(html, "datesData")
    players = _extract_json_var(html, "playersData")
    return matches, players


def _match_rosters(match_id: str) -> Dict[str, Any]:
    url = MATCH_URL.format(match_id=match_id)
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    try:
        return _extract_json_var(resp.text, "rostersData")
    except ValueError:
        return {}


def _build_rows(
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
                    "understat_id": entry.get("player_id"),
                    "player_name": entry.get("player"),
                    "team": (match.get(side, {}) or {}).get("title"),
                    "season": season,
                    "gw": None,
                    "match_date": match_date,
                    "minutes": int(entry.get("time") or 0),
                    "goals": int(entry.get("goals") or 0),
                    "assists": int(entry.get("assists") or 0),
                    "shots": int(entry.get("shots") or 0),
                    "key_passes": int(entry.get("key_passes") or 0),
                    "xg": float(entry.get("xG") or 0),
                    "xa": float(entry.get("xA") or 0),
                    "npg": int(entry.get("npg") or 0),
                    "npxg": float(entry.get("npxG") or 0),
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


def _fuzzy_match_to_players(supabase) -> int:
    """Populate ``matched_fpl_id`` where NULL. Returns number matched."""
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


def fetch_and_sync(
    season: int,
    limit: Optional[int] = None,
    skip_finished_before: Optional[date] = None,
) -> None:
    season_str = f"{season}"
    print(f"Fetching Understat match list for season {season_str}...")
    supabase = get_supabase_client()
    matches, _players = _list_matches(season)
    finished = [m for m in matches if not m.get("isResult", False) is False and m.get("isResult")]
    finished = finished if finished else [m for m in matches if m.get("isResult")]
    if skip_finished_before:
        finished = [
            m
            for m in finished
            if (m.get("datetime") or "")[:10] >= skip_finished_before.isoformat()
        ]
    if limit:
        finished = finished[-limit:]

    print(f"Will scrape {len(finished)} finished matches...")
    all_rows: List[Dict[str, Any]] = []
    for i, m in enumerate(finished, 1):
        mid = str(m.get("id"))
        try:
            rosters = _match_rosters(mid)
        except Exception as exc:
            print(f"  match {mid} failed: {exc}", file=sys.stderr)
            continue
        all_rows.extend(_build_rows(m, rosters, season_str))
        time.sleep(0.3)
        if i % 20 == 0:
            print(f"  scraped {i}/{len(finished)}")

    print(f"Upserting {len(all_rows)} understat rows...")
    upsert_batch(
        supabase,
        "understat_xg",
        all_rows,
        on_conflict="understat_id,season,match_date",
    )

    print("Fuzzy-matching understat rows to players_static...")
    matched = _fuzzy_match_to_players(supabase)
    print(f"  matched {matched} new rows.")
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
