"""Sync the FPL fixture list into Supabase.

Pulls the full season from ``/fixtures/`` (past + future) so we can compute
FDR, form and fixture tickers in the UI.
"""

from __future__ import annotations

import sys
from typing import Any, Dict, List

from .common import fpl_get, get_supabase_client, upsert_batch


def _build_fixture_rows(fixtures: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for f in fixtures:
        rows.append(
            {
                "id": f["id"],
                "gw": f.get("event"),
                "kickoff_time": f.get("kickoff_time"),
                "home_team_id": f.get("team_h"),
                "away_team_id": f.get("team_a"),
                "home_team_score": f.get("team_h_score"),
                "away_team_score": f.get("team_a_score"),
                "home_fdr": f.get("team_h_difficulty"),
                "away_fdr": f.get("team_a_difficulty"),
                "finished": bool(f.get("finished")),
                "finished_provisional": bool(f.get("finished_provisional")),
                "started": bool(f.get("started")),
                "minutes": f.get("minutes") or 0,
            }
        )
    return rows


def fetch_and_sync() -> None:
    print("Fetching FPL fixtures...")
    supabase = get_supabase_client()
    fixtures = fpl_get("/fixtures/")
    print(f"Syncing {len(fixtures)} fixtures...")
    upsert_batch(
        supabase, "fixtures", _build_fixture_rows(fixtures), on_conflict="id"
    )
    print("Done. fixtures table is up to date.")


if __name__ == "__main__":
    try:
        fetch_and_sync()
    except Exception as exc:
        print(f"sync_fpl_fixtures failed: {exc}", file=sys.stderr)
        raise
