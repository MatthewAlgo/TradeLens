#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="services/mock-exchange/app/data"
OUT_FILE="$OUT_DIR/btcusdt_sample.csv"

mkdir -p "$OUT_DIR"

python3 - <<'PY'
import csv
import random
import time

out_file = "services/mock-exchange/app/data/btcusdt_sample.csv"
random.seed(42)

base = 67500.0
ts = int(time.time() * 1000) - 3600 * 1000

with open(out_file, "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["timestamp_ms", "symbol", "trade_id", "price", "quantity", "is_buyer_maker"])
    for i in range(2000):
        ts += random.randint(40, 300)
        base = max(100.0, base + random.uniform(-20.0, 20.0))
        qty = random.uniform(0.001, 0.2)
        w.writerow([ts, "BTCUSDT", 1000000 + i, f"{base:.2f}", f"{qty:.5f}", random.choice(["true", "false"])])

print(f"Wrote {out_file}")
PY
