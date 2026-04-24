"""Sync live per-player stats for a gameweek into ``player_gw_stats``.

Uses ``/event/{gw}/live/``. By default syncs the current gameweek (or the
one passed via ``--gw``, or all finished/in-progress gameweeks via
``--all``). Designed to be run frequently during deadlines.
"""

from __future__ import annotations

import argparse
import sys
from typing import Any, Dict, List

from .common import fpl_get, get_supabase_client, upsert_batch


def _build_rows(gw: int, elements: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for el in elements:
        stats = el.get("stats", {})
        explain = el.get("explain", []) or []
        fixture_id = explain[0]["fixture"] if explain else None
        rows.append(
            {
                "player_id": el["id"],
                "gw": gw,
                "fixture_id": fixture_id,
                "minutes": stats.get("minutes"),
                "goals_scored": stats.get("goals_scored"),
                "assists": stats.get("assists"),
                "clean_sheets": stats.get("clean_sheets"),
                "goals_conceded": stats.get("goals_conceded"),
                "own_goals": stats.get("own_goals"),
                "penalties_saved": stats.get("penalties_saved"),
                "penalties_missed": stats.get("penalties_missed"),
                "yellow_cards": stats.get("yellow_cards"),
                "red_cards": stats.get("red_cards"),
                "saves": stats.get("saves"),
                "bonus": stats.get("bonus"),
                "bps": stats.get("bps"),
                "influence": _num(stats.get("influence")),
                "creativity": _num(stats.get("creativity")),
                "threat": _num(stats.get("threat")),
                "ict_index": _num(stats.get("ict_index")),
                "expected_goals": _num(stats.get("expected_goals")),
                "expected_assists": _num(stats.get("expected_assists")),
                "expected_goal_involve": _num(
                    stats.get("expected_goal_involvements")
                ),
                "expected_goals_conceded": _num(
                    stats.get("expected_goals_conceded")
                ),
                "clearances_blocks_interceptions": stats.get(
                    "clearances_blocks_interceptions"
                ),
                "recoveries": stats.get("recoveries"),
                "tackles": stats.get("tackles"),
                "defensive_contribution": stats.get("defensive_contribution"),
                "starts": stats.get("starts"),
                "total_points": stats.get("total_points"),
            }
        )
    return rows


def _num(val: Any) -> float | None:
    if val in (None, "", "null"):
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _current_and_finished_gws() -> List[int]:
    bs = fpl_get("/bootstrap-static/")
    return [e["id"] for e in bs["events"] if e.get("finished") or e.get("is_current")]


def _current_gw() -> int | None:
    bs = fpl_get("/bootstrap-static/")
    for e in bs["events"]:
        if e.get("is_current"):
            return e["id"]
    return None


def sync_gw(gw: int) -> None:
    print(f"Fetching live stats for GW {gw}...")
    supabase = get_supabase_client()
    data = fpl_get(f"/event/{gw}/live/")
    elements = data.get("elements", [])
    rows = _build_rows(gw, elements)
    print(f"Syncing {len(rows)} player-GW rows for GW {gw}...")
    upsert_batch(
        supabase, "player_gw_stats", rows, on_conflict="player_id,gw"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--gw", type=int, help="Sync a specific gameweek id")
    parser.add_argument(
        "--all",
        action="store_true",
        help="Sync every finished/in-progress gameweek",
    )
    args = parser.parse_args()

    try:
        if args.all:
            for gw in _current_and_finished_gws():
                sync_gw(gw)
        elif args.gw is not None:
            sync_gw(args.gw)
        else:
            gw = _current_gw()
            if gw is None:
                print("No current gameweek; nothing to sync.")
                return
            sync_gw(gw)
    except Exception as exc:
        print(f"sync_fpl_gw_live failed: {exc}", file=sys.stderr)
        raise


if __name__ == "__main__":
    main()
