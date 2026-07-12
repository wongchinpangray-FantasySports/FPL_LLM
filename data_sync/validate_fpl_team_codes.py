"""Validate + optionally refresh web/data/fpl-team-codes.json from vaastav."""

from __future__ import annotations

import csv
import io
import json
import sys
from collections import defaultdict
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
CODES_PATH = ROOT / "web" / "data" / "fpl-team-codes.json"

VAASTAV_BASE = (
    "https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/master/data"
)
SEASONS = [
    "2016-17",
    "2017-18",
    "2018-19",
    "2019-20",
    "2020-21",
    "2021-22",
    "2022-23",
    "2023-24",
    "2024-25",
]


def load_json_codes() -> tuple[dict[str, str], dict[str, str]]:
    data = json.loads(CODES_PATH.read_text(encoding="utf-8"))
    short: dict[str, str] = {}
    name: dict[str, str] = {}
    for row in data["teams"]:
        short[row["code"]] = row["short_name"]
        name[row["code"]] = row["name"]
    return short, name


def fetch_csv(path: str) -> list[dict[str, str]] | None:
    url = f"{VAASTAV_BASE}/{path}"
    try:
        resp = requests.get(url, timeout=90)
    except requests.RequestException as exc:
        print(f"  SKIP {path}: {exc}", file=sys.stderr)
        return None
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    return list(csv.DictReader(io.StringIO(resp.content.decode("utf-8-sig"))))


def validate() -> int:
    short_by_code, name_by_code = load_json_codes()
    seen_codes: dict[str, set[str]] = defaultdict(set)

    for folder in SEASONS:
        for source, filename in (
            ("teams", f"{folder}/teams.csv"),
            ("players", f"{folder}/players_raw.csv"),
        ):
            rows = fetch_csv(filename)
            if not rows:
                continue
            for row in rows:
                code = (row.get("code") or row.get("team_code") or "").strip()
                if code:
                    seen_codes[code].add(folder)

    missing_short = sorted(c for c in seen_codes if c not in short_by_code)
    missing_name = sorted(c for c in seen_codes if c not in name_by_code)

    print(f"Canonical codes in JSON: {len(short_by_code)}")
    print(f"Codes seen in vaastav archives: {len(seen_codes)}")

    if missing_short:
        print("\nMISSING short_name for codes seen in vaastav:")
        for code in missing_short:
            print(f"  {code} (seasons: {sorted(seen_codes[code])})")
    if missing_name:
        print("\nMISSING name for codes seen in vaastav:")
        for code in missing_name:
            print(f"  {code} (seasons: {sorted(seen_codes[code])})")

    unused = sorted(set(short_by_code) - set(seen_codes), key=lambda c: int(c))
    if unused:
        print(f"\nCodes in JSON but not seen in vaastav fetch ({len(unused)}):")
        for code in unused:
            print(f"  {code} {short_by_code[code]} / {name_by_code[code]}")

    ok = not missing_short and not missing_name
    print("\nPASS" if ok else "\nFAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(validate())
