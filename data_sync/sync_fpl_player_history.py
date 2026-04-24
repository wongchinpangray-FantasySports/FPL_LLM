"""Sync per-player history via ``/element-summary/{id}/``.

This backfills ``player_gw_stats`` with rows that may not yet exist (e.g.
for past seasons' double gameweeks, or if the live-endpoint sync missed a
run). It walks every player; this is slow, so it's intended for the daily
cron, not the live one.
"""

from __future__ import annotations

import argparse
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List

from .common import fpl_get, get_supabase_client, upsert_batch


def _num(val: Any) -> float | None:
    if val in (None, "", "null"):
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _history_rows(player_id: int, history: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for h in history:
        rows.append(
            {
                "player_id": player_id,
                "gw": h.get("round"),
                "fixture_id": h.get("fixture"),
                "opponent_team_id": h.get("opponent_team"),
                "was_home": h.get("was_home"),
                "minutes": h.get("minutes"),
                "goals_scored": h.get("goals_scored"),
                "assists": h.get("assists"),
                "clean_sheets": h.get("clean_sheets"),
                "goals_conceded": h.get("goals_conceded"),
                "own_goals": h.get("own_goals"),
                "penalties_saved": h.get("penalties_saved"),
                "penalties_missed": h.get("penalties_missed"),
                "yellow_cards": h.get("yellow_cards"),
                "red_cards": h.get("red_cards"),
                "saves": h.get("saves"),
                "bonus": h.get("bonus"),
                "bps": h.get("bps"),
                "influence": _num(h.get("influence")),
                "creativity": _num(h.get("creativity")),
                "threat": _num(h.get("threat")),
                "ict_index": _num(h.get("ict_index")),
                "expected_goals": _num(h.get("expected_goals")),
                "expected_assists": _num(h.get("expected_assists")),
                "expected_goal_involve": _num(h.get("expected_goal_involvements")),
                "expected_goals_conceded": _num(h.get("expected_goals_conceded")),
                "clearances_blocks_interceptions": h.get(
                    "clearances_blocks_interceptions"
                ),
                "recoveries": h.get("recoveries"),
                "tackles": h.get("tackles"),
                "defensive_contribution": h.get("defensive_contribution"),
                "starts": h.get("starts"),
                "value": (h.get("value") or 0) / 10.0 if h.get("value") else None,
                "selected": h.get("selected"),
                "transfers_in": h.get("transfers_in"),
                "transfers_out": h.get("transfers_out"),
                "total_points": h.get("total_points"),
            }
        )
    return rows


def _fetch_summary(player_id: int) -> List[Dict[str, Any]]:
    data = fpl_get(f"/element-summary/{player_id}/")
    return _history_rows(player_id, data.get("history", []))


def fetch_and_sync(max_workers: int = 6, limit: int | None = None) -> None:
    print("Fetching player index from bootstrap-static...")
    supabase = get_supabase_client()
    bs = fpl_get("/bootstrap-static/")
    player_ids = [p["id"] for p in bs["elements"]]
    if limit:
        player_ids = player_ids[:limit]

    print(f"Fetching history for {len(player_ids)} players (parallel={max_workers})...")
    all_rows: List[Dict[str, Any]] = []
    start = time.time()
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        future_to_pid = {pool.submit(_fetch_summary, pid): pid for pid in player_ids}
        for i, fut in enumerate(as_completed(future_to_pid), start=1):
            pid = future_to_pid[fut]
            try:
                all_rows.extend(fut.result())
            except Exception as exc:
                print(f"  player {pid} failed: {exc}", file=sys.stderr)
            if i % 50 == 0:
                print(f"  fetched {i}/{len(player_ids)} in {time.time() - start:.1f}s")

    deduped: Dict[tuple, Dict[str, Any]] = {}
    for row in all_rows:
        pid = row.get("player_id")
        gw = row.get("gw")
        if pid is None or gw is None:
            continue
        key = (pid, gw)
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
            "clearances_blocks_interceptions",
            "recoveries",
            "tackles",
            "defensive_contribution",
            "starts",
        ):
            a = existing.get(field)
            b = row.get(field)
            if a is None and b is None:
                continue
            existing[field] = (a or 0) + (b or 0)
        for field in ("value", "selected", "transfers_in", "transfers_out", "fixture_id", "opponent_team_id", "was_home"):
            if row.get(field) is not None:
                existing[field] = row.get(field)

    final_rows = list(deduped.values())
    print(
        f"Upserting {len(final_rows)} deduped history rows into player_gw_stats"
        f" (from {len(all_rows)} raw rows)..."
    )
    upsert_batch(
        supabase, "player_gw_stats", final_rows, on_conflict="player_id,gw"
    )
    print("Done.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=6)
    parser.add_argument("--limit", type=int, default=None, help="Only process first N players (debug)")
    args = parser.parse_args()
    try:
        fetch_and_sync(max_workers=args.workers, limit=args.limit)
    except Exception as exc:
        print(f"sync_fpl_player_history failed: {exc}", file=sys.stderr)
        raise


if __name__ == "__main__":
    main()
