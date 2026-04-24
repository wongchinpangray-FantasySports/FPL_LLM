"""Shared helpers for the FPL data-sync scripts.

All sync scripts use ``get_supabase_client`` for DB access and the ``fpl_get``
helper for JSON calls against the official FPL API.
"""

from __future__ import annotations

import os
import sys
import time
from typing import Any, Dict, Iterable, List, TypeVar

import requests
from dotenv import load_dotenv
from supabase import create_client, Client

FPL_BASE = "https://fantasy.premierleague.com/api"

_DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; FPL-LLM/0.1; +https://github.com/)"
    ),
    "Accept": "application/json",
}


def get_supabase_client() -> Client:
    """Return a service-role Supabase client, exiting if env vars are missing."""
    load_dotenv()
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print(
            "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.",
            file=sys.stderr,
        )
        raise SystemExit(1)
    return create_client(url, key)


def fpl_get(path: str, *, timeout: int = 20, retries: int = 3) -> Any:
    """GET ``{FPL_BASE}{path}`` with retries + JSON decode.

    Retries on network errors and 5xx/429 with exponential backoff.
    """
    url = f"{FPL_BASE}{path}"
    last_exc: Exception | None = None
    for attempt in range(retries):
        try:
            resp = requests.get(url, headers=_DEFAULT_HEADERS, timeout=timeout)
            if resp.status_code == 429 or 500 <= resp.status_code < 600:
                raise requests.HTTPError(f"{resp.status_code} for {url}")
            resp.raise_for_status()
            return resp.json()
        except (requests.RequestException, ValueError) as exc:
            last_exc = exc
            sleep = 2**attempt
            print(
                f"[fpl_get] attempt {attempt + 1}/{retries} failed for {path}: {exc}"
                f" (sleeping {sleep}s)",
                file=sys.stderr,
            )
            time.sleep(sleep)
    assert last_exc is not None
    raise last_exc


T = TypeVar("T")


def chunked(items: Iterable[T], size: int) -> Iterable[List[T]]:
    """Yield lists of up to ``size`` items from ``items``."""
    batch: List[T] = []
    for item in items:
        batch.append(item)
        if len(batch) >= size:
            yield batch
            batch = []
    if batch:
        yield batch


def upsert_batch(
    supabase: Client,
    table: str,
    rows: List[Dict[str, Any]],
    *,
    on_conflict: str,
    batch_size: int = 500,
) -> None:
    """Upsert ``rows`` into ``table`` in chunks of ``batch_size``."""
    if not rows:
        return
    total = 0
    for batch in chunked(rows, batch_size):
        supabase.table(table).upsert(batch, on_conflict=on_conflict).execute()
        total += len(batch)
    print(f"  upserted {total} rows into {table}")


POSITION_MAP: Dict[int, str] = {1: "GKP", 2: "DEF", 3: "MID", 4: "FWD"}
