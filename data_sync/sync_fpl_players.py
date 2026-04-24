"""Sync FPL players and teams from bootstrap-static into Supabase.

Run: ``python -m data_sync.sync_fpl_players`` (or just ``python
data_sync/sync_fpl_players.py`` from the repo root).
"""

from __future__ import annotations

import sys
from typing import Any, Dict, List

from .common import (
    POSITION_MAP,
    fpl_get,
    get_supabase_client,
    upsert_batch,
)


def _num(val: Any) -> float | None:
    if val in (None, "", "null"):
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _build_team_rows(teams: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [
        {
            "id": t["id"],
            "name": t["name"],
            "short_name": t["short_name"],
            "code": t.get("code"),
            "strength": t.get("strength"),
            "strength_home": t.get("strength_overall_home"),
            "strength_away": t.get("strength_overall_away"),
            "strength_overall_home": t.get("strength_overall_home"),
            "strength_overall_away": t.get("strength_overall_away"),
            "strength_attack_home": t.get("strength_attack_home"),
            "strength_attack_away": t.get("strength_attack_away"),
            "strength_defence_home": t.get("strength_defence_home"),
            "strength_defence_away": t.get("strength_defence_away"),
        }
        for t in teams
    ]


def _build_gameweek_rows(events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [
        {
            "id": e["id"],
            "name": e.get("name"),
            "deadline_time": e.get("deadline_time"),
            "is_current": bool(e.get("is_current")),
            "is_next": bool(e.get("is_next")),
            "is_previous": bool(e.get("is_previous")),
            "finished": bool(e.get("finished")),
            "data_checked": bool(e.get("data_checked")),
        }
        for e in events
    ]


def _build_player_rows(
    players: List[Dict[str, Any]],
    teams_by_id: Dict[int, Dict[str, Any]],
) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for p in players:
        team = teams_by_id.get(p["team"], {})
        rows.append(
            {
                "fpl_id": p["id"],
                "name": f"{p['first_name']} {p['second_name']}".strip(),
                "first_name": p.get("first_name"),
                "second_name": p.get("second_name"),
                "web_name": p.get("web_name"),
                "team": team.get("name"),
                "team_id": p.get("team"),
                "position": POSITION_MAP.get(p.get("element_type")),
                "base_price": p["now_cost"] / 10.0,
                "status": p.get("status"),
                "news": p.get("news"),
                "chance_of_playing": p.get("chance_of_playing_next_round"),
                "form": _num(p.get("form")),
                "points_per_game": _num(p.get("points_per_game")),
                "total_points": p.get("total_points"),
                "minutes": p.get("minutes"),
                "goals_scored": p.get("goals_scored"),
                "assists": p.get("assists"),
                "clean_sheets": p.get("clean_sheets"),
                "bonus": p.get("bonus"),
                "bps": p.get("bps"),
                "influence": _num(p.get("influence")),
                "creativity": _num(p.get("creativity")),
                "threat": _num(p.get("threat")),
                "ict_index": _num(p.get("ict_index")),
                "expected_goals": _num(p.get("expected_goals")),
                "expected_assists": _num(p.get("expected_assists")),
                "expected_goal_involve": _num(p.get("expected_goal_involvements")),
                "selected_by_percent": _num(p.get("selected_by_percent")),
                "transfers_in_event": p.get("transfers_in_event"),
                "transfers_out_event": p.get("transfers_out_event"),
                "photo": p.get("photo"),
                "penalties_order": p.get("penalties_order"),
                "direct_freekicks_order": p.get("direct_freekicks_order"),
                "corners_and_indirect_freekicks_order": p.get(
                    "corners_and_indirect_freekicks_order"
                ),
                "penalties_text": p.get("penalties_text"),
                "direct_freekicks_text": p.get("direct_freekicks_text"),
                "corners_and_indirect_freekicks_text": p.get(
                    "corners_and_indirect_freekicks_text"
                ),
                "goals_conceded": p.get("goals_conceded"),
                "expected_goals_conceded": _num(p.get("expected_goals_conceded")),
                "saves": p.get("saves"),
                "clearances_blocks_interceptions": p.get(
                    "clearances_blocks_interceptions"
                ),
                "recoveries": p.get("recoveries"),
                "tackles": p.get("tackles"),
                "defensive_contribution": p.get("defensive_contribution"),
                "defensive_contribution_per_90": _num(
                    p.get("defensive_contribution_per_90")
                ),
                "goals_conceded_per_90": _num(p.get("goals_conceded_per_90")),
                "expected_goals_conceded_per_90": _num(
                    p.get("expected_goals_conceded_per_90")
                ),
                "saves_per_90": _num(p.get("saves_per_90")),
                "starts": p.get("starts"),
                "starts_per_90": _num(p.get("starts_per_90")),
            }
        )
    return rows


def fetch_and_sync() -> None:
    print("Fetching FPL bootstrap-static...")
    supabase = get_supabase_client()
    data = fpl_get("/bootstrap-static/")

    teams = data["teams"]
    events = data["events"]
    players = data["elements"]
    teams_by_id = {t["id"]: t for t in teams}

    print(f"Syncing {len(teams)} teams...")
    upsert_batch(supabase, "teams", _build_team_rows(teams), on_conflict="id")

    print(f"Syncing {len(events)} gameweeks...")
    upsert_batch(
        supabase, "gameweeks", _build_gameweek_rows(events), on_conflict="id"
    )

    print(f"Syncing {len(players)} players...")
    upsert_batch(
        supabase,
        "players_static",
        _build_player_rows(players, teams_by_id),
        on_conflict="fpl_id",
    )

    print("Done. players_static / teams / gameweeks are up to date.")


if __name__ == "__main__":
    try:
        fetch_and_sync()
    except Exception as exc:
        print(f"sync_fpl_players failed: {exc}", file=sys.stderr)
        raise
