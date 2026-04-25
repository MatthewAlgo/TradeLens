#!/usr/bin/env bash
set -euo pipefail

API_URL=${API_URL:-http://localhost:4000/api}

REQ='{
  "strategy": "sma_crossover",
  "symbol": "BTCUSDT",
  "interval": "1h",
  "start_date": "2024-01-01",
  "end_date": "2024-01-31",
  "initial_capital": 100000,
  "commission_rate": 0.001
}'

echo "Submitting backtest..."
RESP=$(curl -sS -X POST "$API_URL/backtest/run" -H 'Content-Type: application/json' -d "$REQ")
ID=$(echo "$RESP" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("backtest_id",""))')

if [[ -z "$ID" ]]; then
  echo "Failed to start backtest: $RESP"
  exit 1
fi

echo "Backtest id: $ID"

for _ in $(seq 1 120); do
  STATUS=$(curl -sS "$API_URL/backtest/$ID")
  STATE=$(echo "$STATUS" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("status",""))')
  echo "status=$STATE"

  if [[ "$STATE" == "completed" ]]; then
    echo "$STATUS"
    exit 0
  fi

  if [[ "$STATE" == "failed" ]]; then
    echo "$STATUS"
    exit 1
  fi

  sleep 1
done

echo "Backtest polling timeout"
exit 1
