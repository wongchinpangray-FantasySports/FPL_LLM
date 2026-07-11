"""Backfill ``player_gw_stats`` + ``player_season_profiles`` from vaastav/Fantasy-Premier-League.

The official FPL API only exposes per-GW ``history`` for the active season.
Vaastav's repo archives ``merged_gw.csv`` per campaign (2016/17 onward).

Usage:
  python -m data_sync.backfill_vaastav_seasons
  python -m data_sync.backfill_vaastav_seasons --seasons 2022-23 2023-24
  python -m data_sync.backfill_vaastav_seasons --skip-existing
"""

from __future__ import annotations

import argparse
import csv
import io
import sys
from typing import Any, Dict, Iterable, List, Tuple

import requests

from .common import get_supabase_client, upsert_batch

VAASTAV_BASE = (
    "https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/master/data"
)

# FPL campaigns available in vaastav (folder name → skipped when using live API only).
DEFAULT_SEASON_FOLDERS: Tuple[str, ...] = (
    "2016-17",
    "2017-18",
    "2018-19",
    "2019-20",
    "2020-21",
    "2021-22",
    "2022-23",
    "2023-24",
    "2024-25",
)

POSITIONS = {"GKP", "DEF", "MID", "FWD"}


def _num(val: Any) -> float | None:
    if val in (None, "", "null"):
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _int(val: Any) -> int | None:
    n = _num(val)
    if n is None:
        return None
    return int(n)


def season_folder_to_start_year(folder: str) -> str:
    return folder.strip().split("-", 1)[0]


def _download_csv(folder: str, filename: str) -> List[Dict[str, str]]:
    url = f"{VAASTAV_BASE}/{folder}/gws/{filename}"
    print(f"  GET {url}")
    resp = requests.get(url, timeout=120)
    resp.raise_for_status()
    raw = resp.content
    text: str | None = None
    for encoding in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            text = raw.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    if text is None:
        text = raw.decode("utf-8", errors="replace")
    return list(csv.DictReader(io.StringIO(text)))


def _normalize_position(raw: str) -> str:
    p = (raw or "").strip().upper()
    return p if p in POSITIONS else ""


def _gw_rows_from_csv(
    folder: str, rows: Iterable[Dict[str, str]]
) -> Tuple[List[Dict[str, Any]], Dict[int, Dict[str, str]]]:
    season = season_folder_to_start_year(folder)
    gw_rows: List[Dict[str, Any]] = []
    profiles: Dict[int, Dict[str, str]] = {}

    for row in rows:
        player_id = _int(row.get("element"))
        gw = _int(row.get("GW") or row.get("round"))
        if player_id is None or gw is None or gw <= 0:
            continue

        name = (row.get("name") or "").strip()
        team = (row.get("team") or "").strip()
        position = _normalize_position(row.get("position") or "")

        if name and player_id not in profiles:
            profiles[player_id] = {
                "player_id": str(player_id),
                "season": season,
                "web_name": name,
                "name": name,
                "team": team,
                "position": position,
            }
        elif player_id in profiles:
            if team and not profiles[player_id].get("team"):
                profiles[player_id]["team"] = team
            if position and not profiles[player_id].get("position"):
                profiles[player_id]["position"] = position

        gw_rows.append(
            {
                "player_id": player_id,
                "season": season,
                "gw": gw,
                "fixture_id": _int(row.get("fixture")),
                "opponent_team_id": _int(row.get("opponent_team")),
                "was_home": str(row.get("was_home", "")).lower() == "true",
                "minutes": _int(row.get("minutes")),
                "goals_scored": _int(row.get("goals_scored")),
                "assists": _int(row.get("assists")),
                "clean_sheets": _int(row.get("clean_sheets")),
                "goals_conceded": _int(row.get("goals_conceded")),
                "own_goals": _int(row.get("own_goals")),
                "penalties_saved": _int(row.get("penalties_saved")),
                "penalties_missed": _int(row.get("penalties_missed")),
                "yellow_cards": _int(row.get("yellow_cards")),
                "red_cards": _int(row.get("red_cards")),
                "saves": _int(row.get("saves")),
                "bonus": _int(row.get("bonus")),
                "bps": _int(row.get("bps")),
                "influence": _num(row.get("influence")),
                "creativity": _num(row.get("creativity")),
                "threat": _num(row.get("threat")),
                "ict_index": _num(row.get("ict_index")),
                "expected_goals": _num(row.get("expected_goals")),
                "expected_assists": _num(row.get("expected_assists")),
                "expected_goal_involve": _num(row.get("expected_goal_involvements")),
                "expected_goals_conceded": _num(row.get("expected_goals_conceded")),
                "defensive_contribution": _int(row.get("defensive_contribution")),
                "starts": _int(row.get("starts")),
                "value": (_num(row.get("value")) or 0) / 10.0 if row.get("value") else None,
                "selected": _int(row.get("selected")),
                "transfers_in": _int(row.get("transfers_in")),
                "transfers_out": _int(row.get("transfers_out")),
                "total_points": _int(row.get("total_points")),
            }
        )

    return gw_rows, profiles


def _dedupe_gw_rows(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    deduped: Dict[tuple, Dict[str, Any]] = {}
    for row in rows:
        pid = row.get("player_id")
        gw = row.get("gw")
        season = row.get("season")
        if pid is None or gw is None:
            continue
        key = (pid, gw, season)
        existing = deduped.get(key)
        if existing is None:
            deduped[key] = dict(row)
            continue
        for field in (
            "minutes",
            "goals_scored",
            "assists",
            "clean_sheets",
            "goals_conceded",
            "own_goals",
            "penalties_saved",
            "penalties_missed",
            "yellow_cards",
            "red_cards",
            "saves",
            "bonus",
            "bps",
            "total_points",
            "influence",
            "creativity",
            "threat",
            "ict_index",
            "expected_goals",
            "expected_assists",
            "expected_goal_involve",
            "expected_goals_conceded",
            "defensive_contribution",
            "starts",
        ):
            a = existing.get(field)
            b = row.get(field)
            if a is None and b is None:
                continue
            existing[field] = (a or 0) + (b or 0)
        for field in (
            "value",
            "selected",
            "transfers_in",
            "transfers_out",
            "fixture_id",
            "opponent_team_id",
            "was_home",
        ):
            if row.get(field) is not None:
                existing[field] = row.get(field)
    return list(deduped.values())


def _season_has_data(supabase, season: str) -> bool:
    res = (
        supabase.table("player_gw_stats")
        .select("player_id", count="exact")
        .eq("season", season)
        .limit(1)
        .execute()
    )
    return bool(getattr(res, "count", 0))


def backfill_season(
    supabase,
    folder: str,
    *,
    skip_existing: bool = False,
) -> None:
    season = season_folder_to_start_year(folder)
    if skip_existing and _season_has_data(supabase, season):
        print(f"Skipping {folder} ({season}) — rows already in player_gw_stats")
        return

    print(f"Backfilling {folder} → season key {season}...")
    csv_rows = _download_csv(folder, "merged_gw.csv")
    gw_rows, profiles = _gw_rows_from_csv(folder, csv_rows)
    final_gw = _dedupe_gw_rows(gw_rows)
    profile_rows = [
        {
            "player_id": int(p["player_id"]),
            "season": p["season"],
            "web_name": p["web_name"],
            "name": p["name"],
            "team": p["team"],
            "position": p["position"],
        }
        for p in profiles.values()
    ]

    print(
        f"  {len(final_gw)} GW rows, {len(profile_rows)} player profiles "
        f"(from {len(gw_rows)} raw CSV rows)"
    )
    try:
        upsert_batch(
            supabase,
            "player_season_profiles",
            profile_rows,
            on_conflict="player_id,season",
        )
    except Exception as exc:
        msg = str(exc)
        if "player_season_profiles" in msg or "PGRST205" in msg:
            print(
                "  WARNING: player_season_profiles missing — apply "
                "supabase/migrations/0022_player_season_profiles.sql",
                file=sys.stderr,
            )
        else:
            raise
    upsert_batch(
        supabase,
        "player_gw_stats",
        final_gw,
        on_conflict="player_id,gw,season",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill historical FPL GW data from vaastav")
    parser.add_argument(
        "--seasons",
        nargs="*",
        default=list(DEFAULT_SEASON_FOLDERS),
        help='Campaign folders e.g. "2022-23" "2023-24"',
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip seasons that already have player_gw_stats rows",
    )
    args = parser.parse_args()

    supabase = get_supabase_client()
    for folder in args.seasons:
        try:
            backfill_season(supabase, folder, skip_existing=args.skip_existing)
        except Exception as exc:
            print(f"  FAILED {folder}: {exc}", file=sys.stderr)

    print("Done.")


if __name__ == "__main__":
    main()
