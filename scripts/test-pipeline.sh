#!/usr/bin/env bash
set -euo pipefail

echo "Checking stack health..."
docker compose ps >/dev/null

echo "Ensuring topics..."
./scripts/create-topics.sh

echo "Waiting briefly for pipeline warm-up..."
sleep 8

echo "Validating TimescaleDB outputs..."
CANDLES=$(docker exec tradelens-timescaledb psql -U tradelens -d market_data -tAc "select count(*) from candles;")
FOOTPRINTS=$(docker exec tradelens-timescaledb psql -U tradelens -d market_data -tAc "select count(*) from footprints;")

echo "candles=$CANDLES footprints=$FOOTPRINTS"

if [[ "${CANDLES:-0}" -lt 1 ]]; then
  echo "Pipeline test failed: no candles written"
  exit 1
fi

if [[ "${FOOTPRINTS:-0}" -lt 1 ]]; then
  echo "Pipeline test failed: no footprints written"
  exit 1
fi

echo "Pipeline test passed"
