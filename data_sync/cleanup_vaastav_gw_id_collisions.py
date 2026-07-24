"""Remove vaastav GW rows that were stored under remapped element ids.

Vaastav's 2025-26 archive still maps element id 291 → Tarkowski, while the live
2026/27 bootstrap maps 291 → Matazo. If both vaastav backfill and live FPL sync
wrote ``player_gw_stats`` for season ``2025``, the historical page attaches the
wrong player's points to promoted-club players.

This script deletes GW rows for season keys where the vaastav archive assigns a
different player to the same element id than the live bootstrap does.

Usage:
  python -m data_sync.cleanup_vaastav_gw_id_collisions --dry-run
  python -m data_sync.cleanup_vaastav_gw_id_collisions --season 2025
"""

from __future__ import annotations

import argparse
import sys
from typing import Dict, Set

from .backfill_vaastav_seasons import (
    VAASTAV_GW_CUTOFF_START_YEAR,
    _download_season_csv,
    _load_players_raw,
    season_folder_to_start_year,
)
from .common import fpl_get, get_supabase_client


def _norm_name(value: str) -> str:
    return " ".join((value or "").lower().split())


def _live_code_by_id() -> Dict[int, int]:
    bs = fpl_get("/bootstrap-static/")
    out: Dict[int, int] = {}
    for el in bs.get("elements", []):
        pid = el.get("id")
        code = el.get("code")
        if pid is None or code is None:
            continue
        out[int(pid)] = int(code)
    return out


def _vaastav_code_by_id(season_folder: str) -> Dict[int, int]:
    rows = _download_season_csv(season_folder, "players_raw.csv") or []
    out: Dict[int, int] = {}
    for row in rows:
        try:
            pid = int(row.get("id") or "")
            code = int(row.get("code") or "")
        except (TypeError, ValueError):
            continue
        if pid > 0 and code > 0:
            out[pid] = code
    return out


def _colliding_ids(season_folder: str) -> Set[int]:
    players_raw = _load_players_raw(season_folder)
    live_codes = _live_code_by_id()
    vaastav_code_by_id = _vaastav_code_by_id(season_folder)
    vaastav_name_by_id = {
        pid: _norm_name(meta.get("web_name") or meta.get("name") or "")
        for pid, meta in players_raw.items()
    }

    bs = fpl_get("/bootstrap-static/")
    live_name_by_id = {
        int(el["id"]): _norm_name(str(el.get("web_name") or ""))
        for el in bs.get("elements", [])
        if el.get("id") is not None
    }

    collisions: Set[int] = set()
    for pid, vaastav_name in vaastav_name_by_id.items():
        live_name = live_name_by_id.get(pid)
        if not live_name or not vaastav_name:
            continue
        if live_name == vaastav_name:
            continue
        vaastav_code = vaastav_code_by_id.get(pid)
        live_code = live_codes.get(pid)
        if vaastav_code is not None and live_code is not None and vaastav_code == live_code:
            continue
        collisions.add(pid)
    return collisions


def cleanup(*, season: str, dry_run: bool) -> int:
    folder = f"{season}-{str(int(season) + 1)[-2:]}"
    if int(season) < VAASTAV_GW_CUTOFF_START_YEAR:
        print(f"Season {season} is before vaastav/live id collision era — nothing to do.")
        return 0

    ids = sorted(_colliding_ids(folder))
    if not ids:
        print(f"No colliding element ids found for {season}/26.")
        return 0

    print(f"Colliding element ids for season {season}: {len(ids)}")
    supabase = get_supabase_client()
    deleted = 0
    chunk = 40
    for i in range(0, len(ids), chunk):
        batch = ids[i : i + chunk]
        query = (
            supabase.table("player_gw_stats")
            .delete()
            .eq("season", season)
            .in_("player_id", batch)
        )
        if dry_run:
            res = (
                supabase.table("player_gw_stats")
                .select("player_id", count="exact")
                .eq("season", season)
                .in_("player_id", batch)
                .execute()
            )
            deleted += int(getattr(res, "count", 0) or 0)
            continue
        res = query.execute()
        deleted += len(res.data or [])

    action = "Would delete" if dry_run else "Deleted"
    print(f"{action} {deleted} player_gw_stats rows for season {season}.")
    return deleted


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Delete vaastav GW rows stored under remapped FPL element ids",
    )
    parser.add_argument(
        "--season",
        default=str(VAASTAV_GW_CUTOFF_START_YEAR),
        help="FPL season start year (default: 2025 for 2025/26)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report row counts without deleting",
    )
    args = parser.parse_args()
    season = season_folder_to_start_year(f"{args.season}-{str(int(args.season)+1)[-2:]}")
    cleanup(season=season, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
