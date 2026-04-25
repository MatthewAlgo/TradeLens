"""Replay data loader for mock-exchange."""

from __future__ import annotations

import csv
import json
import os
from typing import List, Tuple


TickEntry = Tuple[float, dict]


def _to_bool(value: str) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes", "y"}


def _load_csv(path: str) -> List[TickEntry]:
    ticks: List[TickEntry] = []
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            ts_ms = int(row["timestamp_ms"])
            tick = {
                "e": "trade",
                "E": ts_ms,
                "s": row.get("symbol", "BTCUSDT"),
                "t": int(row.get("trade_id", "0")),
                "p": row.get("price", "0"),
                "q": row.get("quantity", "0"),
                "T": ts_ms,
                "m": _to_bool(row.get("is_buyer_maker", "false")),
                "M": True,
            }
            ticks.append((ts_ms / 1000.0, tick))
    return sorted(ticks, key=lambda t: t[0])


def _load_json(path: str) -> List[TickEntry]:
    ticks: List[TickEntry] = []
    with open(path, "r", encoding="utf-8") as f:
        payload = json.load(f)

    if isinstance(payload, dict):
        payload = payload.get("ticks", [])

    for row in payload:
        ts_ms = int(row.get("timestamp_ms", row.get("T", 0)))
        tick = {
            "e": "trade",
            "E": ts_ms,
            "s": row.get("symbol", row.get("s", "BTCUSDT")),
            "t": int(row.get("trade_id", row.get("t", 0))),
            "p": str(row.get("price", row.get("p", 0))),
            "q": str(row.get("quantity", row.get("q", 0))),
            "T": ts_ms,
            "m": bool(row.get("is_buyer_maker", row.get("m", False))),
            "M": True,
        }
        ticks.append((ts_ms / 1000.0, tick))

    return sorted(ticks, key=lambda t: t[0])


def load_ticks(path: str) -> List[TickEntry]:
    """Load tick replay entries from csv/json file.

    Returns an empty list if the path is invalid or the format is unsupported.
    """
    if not path:
        return []

    if not os.path.exists(path):
        return []

    ext = os.path.splitext(path)[1].lower()
    if ext == ".csv":
        return _load_csv(path)
    if ext == ".json":
        return _load_json(path)
    return []
