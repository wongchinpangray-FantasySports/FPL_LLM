"""Validate historical FPL data in Supabase against vaastav source CSVs.

Usage:
  python -m data_sync.validate_historical_data
  python -m data_sync.validate_historical_data --seasons 2016-17 2020-21
"""

from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List, Tuple

# Vaastav archive is authoritative for completed seasons through 2023/24.
# 2024/25 may also be synced live from the FPL API (season keys 2024/2025).
ARCHIVED_SEASON_FOLDERS: Tuple[str, ...] = (
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
from .backfill_vaastav_seasons import (
    _dedupe_gw_rows,
    _download_csv,
    _gw_rows_from_csv,
    _load_players_raw,
    _load_team_name_maps,
    _resolve_team_name,
    season_folder_to_start_year,
)
from .common import get_supabase_client


@dataclass
class SeasonReport:
    folder: str
    season: str
    profile_count: int = 0
    gw_row_count: int = 0
    expected_gw_rows: int = 0
    wrong_team_vs_raw: int = 0
    wrong_team_vs_modal: int = 0
    wrong_position: int = 0
    empty_team: int = 0
    missing_profiles: int = 0
    gw_total_mismatches: int = 0
    issues: List[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return (
            self.gw_row_count == self.expected_gw_rows
            and self.wrong_team_vs_raw == 0
            and self.wrong_team_vs_modal == 0
            and self.wrong_position == 0
            and self.empty_team == 0
            and self.missing_profiles == 0
            and self.gw_total_mismatches == 0
        )


def _fetch_all(table: str, select: str, *, season: str | None = None) -> List[Dict[str, Any]]:
    supabase = get_supabase_client()
    rows: List[Dict[str, Any]] = []
    start = 0
    page = 1000
    while True:
        query = supabase.table(table).select(select)
        if season:
            query = query.eq("season", season)
        batch = query.range(start, start + page - 1).execute().data or []
        rows.extend(batch)
        if len(batch) < page:
            break
        start += page
    return rows


def _csv_player_agg(folder: str) -> Dict[int, Dict[str, Any]]:
    """Aggregate per-player totals from vaastav, matching backfill dedupe logic."""
    csv_rows = _download_csv(folder, "merged_gw.csv")
    gw_rows, _ = _gw_rows_from_csv(folder, csv_rows)
    deduped = _dedupe_gw_rows(gw_rows)
    agg: Dict[int, Dict[str, Any]] = defaultdict(
        lambda: {"tp": 0, "min": 0, "g": 0, "a": 0, "apps": 0, "teams": Counter()}
    )
    for row in deduped:
        pid = int(row["player_id"])
        mins = int(row.get("minutes") or 0)
        entry = agg[pid]
        entry["tp"] += int(row.get("total_points") or 0)
        entry["min"] += mins
        entry["g"] += int(row.get("goals_scored") or 0)
        entry["a"] += int(row.get("assists") or 0)
        if mins > 0:
            entry["apps"] += 1

    for row in csv_rows:
        try:
            pid = int(float(row.get("element") or 0))
        except (TypeError, ValueError):
            continue
        team = (row.get("team") or "").strip()
        if pid > 0 and team:
            agg[pid]["teams"][team] += 1
    return dict(agg)


def _db_player_agg(
    season: str,
    player_id: int,
    cache: Dict[str, List[Dict[str, Any]]],
) -> Dict[str, int]:
    if season not in cache:
        cache[season] = _fetch_all(
            "player_gw_stats",
            "minutes,goals_scored,assists,total_points,player_id",
            season=season,
        )
    rows = [r for r in cache[season] if int(r["player_id"]) == player_id]
    return {
        "tp": sum(int(r.get("total_points") or 0) for r in rows),
        "min": sum(int(r.get("minutes") or 0) for r in rows),
        "g": sum(int(r.get("goals_scored") or 0) for r in rows),
        "a": sum(int(r.get("assists") or 0) for r in rows),
        "apps": sum(1 for r in rows if int(r.get("minutes") or 0) > 0),
    }


def validate_season(folder: str) -> SeasonReport:
    season = season_folder_to_start_year(folder)
    report = SeasonReport(folder=folder, season=season)

    csv_rows = _download_csv(folder, "merged_gw.csv")
    gw_rows, _ = _gw_rows_from_csv(folder, csv_rows)
    report.expected_gw_rows = len(_dedupe_gw_rows(gw_rows))
    report.gw_row_count = len(_fetch_all("player_gw_stats", "player_id,gw", season=season))

    if report.gw_row_count != report.expected_gw_rows:
        report.issues.append(
            f"GW row count mismatch: db={report.gw_row_count} expected={report.expected_gw_rows}"
        )

    players_raw = _load_players_raw(folder)
    team_by_id, team_by_code = _load_team_name_maps(folder)
    csv_agg = _csv_player_agg(folder)
    profiles = {
        int(r["player_id"]): r
        for r in _fetch_all(
            "player_season_profiles",
            "player_id,web_name,name,team,position",
            season=season,
        )
    }
    report.profile_count = len(profiles)

    has_csv_team = any(entry["teams"] for entry in csv_agg.values())

    for pid, meta in players_raw.items():
        profile = profiles.get(pid)
        if profile is None:
            report.missing_profiles += 1
            continue

        expected_team = _resolve_team_name(
            meta["team_id"], meta["team_code"], team_by_id, team_by_code
        )
        db_team = (profile.get("team") or "").strip()
        if not db_team:
            report.empty_team += 1
        elif has_csv_team:
            teams: Counter = csv_agg.get(pid, {}).get("teams", Counter())
            if teams:
                modal_team = teams.most_common(1)[0][0]
                if db_team != modal_team:
                    report.wrong_team_vs_modal += 1
            elif expected_team and db_team != expected_team:
                report.wrong_team_vs_raw += 1
        elif expected_team and db_team != expected_team:
            report.wrong_team_vs_raw += 1

        expected_pos = meta["position"]
        db_pos = (profile.get("position") or "").strip()
        if expected_pos and db_pos and db_pos != expected_pos:
            report.wrong_position += 1

    # Spot-check top 10 scorers' season totals.
    gw_cache: Dict[str, List[Dict[str, Any]]] = {}
    top_ids = sorted(csv_agg.items(), key=lambda x: -x[1]["tp"])[:10]
    for pid, expected in top_ids:
        got = _db_player_agg(season, pid, gw_cache)
        exp = {k: expected[k] for k in ("tp", "min", "g", "a", "apps")}
        if got != exp:
            report.gw_total_mismatches += 1
            name = profiles.get(pid, {}).get("web_name", str(pid))
            report.issues.append(
                f"Totals mismatch {name} ({pid}): db={got} csv={exp}"
            )

    return report


def _print_report(report: SeasonReport) -> None:
    status = "PASS" if report.ok else "WARN" if report.gw_total_mismatches == 0 else "FAIL"
    print(f"\n{report.folder} ({report.season}) [{status}]")
    print(
        f"  profiles={report.profile_count} gw_rows={report.gw_row_count}/"
        f"{report.expected_gw_rows}"
    )
    print(
        f"  empty_team={report.empty_team} missing_profiles={report.missing_profiles} "
        f"wrong_team_vs_raw={report.wrong_team_vs_raw} "
        f"wrong_team_vs_modal={report.wrong_team_vs_modal} "
        f"wrong_position={report.wrong_position} gw_total_mismatches={report.gw_total_mismatches}"
    )
    for issue in report.issues[:8]:
        safe = issue.encode("ascii", "backslashreplace").decode("ascii")
        print(f"  - {safe}")
    if len(report.issues) > 8:
        print(f"  - ... and {len(report.issues) - 8} more")


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate historical FPL backfill accuracy")
    parser.add_argument(
        "--seasons",
        nargs="*",
        default=list(ARCHIVED_SEASON_FOLDERS),
        help='Campaign folders e.g. "2020-21" (defaults to archived 2016-17..2023-24)',
    )
    args = parser.parse_args(list(argv) if argv is not None else None)

    print("Historical FPL data accuracy audit (Supabase vs vaastav)")
    reports = [validate_season(folder) for folder in args.seasons]

    for report in reports:
        _print_report(report)

    hard_fail = any(r.gw_row_count != r.expected_gw_rows or r.gw_total_mismatches for r in reports)
    soft_warn = any(
        r.empty_team or r.wrong_team_vs_raw or r.wrong_team_vs_modal or r.missing_profiles
        for r in reports
    )

    print("\nSummary")
    print(f"  seasons checked: {len(reports)}")
    print(f"  hard failures (GW counts/totals): {sum(1 for r in reports if r.gw_row_count != r.expected_gw_rows or r.gw_total_mismatches)}")
    print(f"  metadata warnings: {sum(1 for r in reports if r.empty_team or r.wrong_team_vs_raw or r.wrong_team_vs_modal or r.missing_profiles)}")

    if hard_fail:
        return 1
    if soft_warn:
        return 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
