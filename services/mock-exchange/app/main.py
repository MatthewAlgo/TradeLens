"""
TradeLens Mock Exchange — WebSocket server that replays historical tick data.
Mimics Binance trade stream JSON format for local development and testing.
"""

import asyncio
import json
import time
import random
import math
import websockets
import os
import logging
from app.replayer import load_ticks

logging.basicConfig(level=logging.INFO, format='%(asctime)s [MockExchange] %(message)s')
logger = logging.getLogger(__name__)

# Configuration
REPLAY_SPEED = int(os.getenv("REPLAY_SPEED", "10"))
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8765"))
DATA_FILE = os.getenv("MOCK_DATA_FILE", "")


def generate_realistic_btc_ticks(base_price: float = 67500.0, duration_seconds: int = 86400):
    """
    Generate realistic BTC/USDT tick data using geometric Brownian motion.
    Produces ~24 hours of synthetic trade data with realistic patterns.
    """
    ticks = []
    current_price = base_price
    current_time = time.time() - duration_seconds
    volatility = 0.0002  # Per-tick volatility
    drift = 0.00001      # Slight upward drift

    num_ticks = duration_seconds * 5  # ~5 trades per second average

    for i in range(num_ticks):
        # Geometric Brownian Motion price evolution
        dt = random.expovariate(5)  # Random inter-arrival time (~5/sec)
        current_time += dt

        # Add micro-structure: occasional bursts of activity
        burst = 1.0
        if random.random() < 0.02:  # 2% chance of burst
            burst = random.uniform(3.0, 8.0)

        shock = random.gauss(drift, volatility * burst)
        current_price *= math.exp(shock)
        current_price = round(current_price, 2)

        # Realistic volume distribution (log-normal)
        quantity = round(random.lognormvariate(-4, 1.5), 5)
        quantity = max(0.00001, min(quantity, 10.0))

        # 48% buyer-maker (slightly more buying pressure)
        is_buyer_maker = random.random() < 0.48

        tick = {
            "e": "trade",
            "E": int(current_time * 1000),
            "s": "BTCUSDT",
            "t": 1000000 + i,
            "p": f"{current_price:.2f}",
            "q": f"{quantity:.5f}",
            "T": int(current_time * 1000),
            "m": is_buyer_maker,
            "M": True
        }
        ticks.append((current_time, tick))

    logger.info("Generated %d synthetic BTC/USDT ticks", len(ticks))
    return ticks


def generate_realistic_eth_ticks(base_price: float = 3450.0, duration_seconds: int = 86400):
    """Generate realistic ETH/USDT tick data."""
    ticks = []
    current_price = base_price
    current_time = time.time() - duration_seconds
    volatility = 0.0003
    drift = 0.000015

    num_ticks = duration_seconds * 3  # ~3 trades per second

    for i in range(num_ticks):
        dt = random.expovariate(3)
        current_time += dt
        burst = 1.0
        if random.random() < 0.02:
            burst = random.uniform(3.0, 8.0)

        shock = random.gauss(drift, volatility * burst)
        current_price *= math.exp(shock)
        current_price = round(current_price, 2)

        quantity = round(random.lognormvariate(-2, 1.2), 4)
        quantity = max(0.0001, min(quantity, 100.0))

        is_buyer_maker = random.random() < 0.48

        tick = {
            "e": "trade",
            "E": int(current_time * 1000),
            "s": "ETHUSDT",
            "t": 2000000 + i,
            "p": f"{current_price:.2f}",
            "q": f"{quantity:.4f}",
            "T": int(current_time * 1000),
            "m": is_buyer_maker,
            "M": True
        }
        ticks.append((current_time, tick))

    logger.info("Generated %d synthetic ETH/USDT ticks", len(ticks))
    return ticks


class MockExchange:
    def __init__(self):
        self.clients: set = set()
        self.ticks = []
        self.is_running = False
        self.paused = False

    def load_data(self):
        """Load replay data from file or generate synthetic ticks."""
        if DATA_FILE:
            replay_ticks = load_ticks(DATA_FILE)
            if replay_ticks:
                self.ticks = replay_ticks
                logger.info("Loaded %d replay ticks from %s", len(self.ticks), DATA_FILE)
                return

        logger.info("Generating synthetic market data...")
        btc_ticks = generate_realistic_btc_ticks()
        eth_ticks = generate_realistic_eth_ticks()

        self.ticks = sorted(btc_ticks + eth_ticks, key=lambda x: x[0])
        logger.info("Total ticks ready: %d", len(self.ticks))

    async def register(self, websocket):
        self.clients.add(websocket)
        logger.info("Client connected. Total clients: %d", len(self.clients))

    async def unregister(self, websocket):
        self.clients.discard(websocket)
        logger.info("Client disconnected. Total clients: %d", len(self.clients))

    async def broadcast(self, message: str):
        if self.clients:
            await asyncio.gather(
                *[client.send(message) for client in self.clients],
                return_exceptions=True
            )

    async def replay_loop(self):
        """Replay tick data at configurable speed, loop forever."""
        while True:
            if not self.ticks:
                logger.warning("No tick data loaded. Waiting...")
                await asyncio.sleep(5)
                continue

            logger.info("Starting replay at %sx speed...", REPLAY_SPEED)
            self.is_running = True

            prev_time = self.ticks[0][0]
            tick_count = 0
            batch_start = time.time()

            for ts, tick in self.ticks:
                if not self.clients:
                    await asyncio.sleep(0.1)
                    continue

                if self.paused:
                    await asyncio.sleep(0.2)
                    continue

                # Calculate delay based on replay speed
                delay = (ts - prev_time) / REPLAY_SPEED
                if delay > 0 and delay < 1.0:
                    await asyncio.sleep(delay)

                # Update timestamp to "now" for realistic live feel
                now_ms = int(time.time() * 1000)
                tick["E"] = now_ms
                tick["T"] = now_ms

                await self.broadcast(json.dumps(tick))
                prev_time = ts
                tick_count += 1

                # Log throughput every 10000 ticks
                if tick_count % 10000 == 0:
                    elapsed = time.time() - batch_start
                    rate = tick_count / elapsed if elapsed > 0 else 0
                    logger.info("Replayed %d ticks (%0.0f ticks/sec)", tick_count, rate)

            logger.info("Replay complete. %d ticks sent. Looping...", tick_count)

    async def handler(self, websocket):
        """Handle individual WebSocket connections."""
        await self.register(websocket)
        try:
            async for message in websocket:
                # Handle subscription messages (Binance-style)
                try:
                    data = json.loads(message)
                    if data.get("method") == "SUBSCRIBE":
                        response = {"result": None, "id": data.get("id", 1)}
                        await websocket.send(json.dumps(response))
                        logger.info("Client subscribed to: %s", data.get("params", []))

                    if data.get("action") == "pause":
                        self.paused = True
                        await websocket.send(json.dumps({"type": "control", "status": "paused"}))
                        logger.info("Replay paused via control message")

                    if data.get("action") == "resume":
                        self.paused = False
                        await websocket.send(json.dumps({"type": "control", "status": "resumed"}))
                        logger.info("Replay resumed via control message")
                except json.JSONDecodeError:
                    pass
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            await self.unregister(websocket)


async def main():
    exchange = MockExchange()
    exchange.load_data()

    # Start WebSocket server
    server = await websockets.serve(exchange.handler, HOST, PORT)
    logger.info("Mock Exchange running on ws://%s:%s", HOST, PORT)
    logger.info("Replay speed: %sx", REPLAY_SPEED)

    # Start replay in background
    replay_task = asyncio.create_task(exchange.replay_loop())

    await asyncio.gather(server.wait_closed(), replay_task)


if __name__ == "__main__":
    asyncio.run(main())
