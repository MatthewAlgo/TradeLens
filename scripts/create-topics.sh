#!/usr/bin/env bash
set -euo pipefail

BROKER_CONTAINER=${BROKER_CONTAINER:-tradelens-redpanda}

topics=(raw_ticks candles footprints order_events orderbook_updates)

for topic in "${topics[@]}"; do
  docker exec "$BROKER_CONTAINER" rpk topic create "$topic" --partitions 4 --config retention.ms=-1 >/dev/null 2>&1 || true
done

echo "Topics ensured: ${topics[*]}"
