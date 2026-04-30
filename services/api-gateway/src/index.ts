import express from 'express';
import http from 'http';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { Kafka, Consumer } from 'kafkajs';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { loadEnv } from './config/env';
import { optionalBearerAuth } from './middleware/auth';
import { tokenBucket } from './middleware/rateLimit';
import { registerHealthRoutes } from './routes/health';
import { buildFootprintCandles, enrichFootprintPayload } from './footprints/compute';
import { parseSubscriptionMessage, shouldDeliver } from './ws/subscriptions';

const env = loadEnv();
const PORT = env.port;
const REDPANDA_BROKERS = env.brokers;
const TIMESCALE_DSN = env.timescaleDsn;
const OMS_URL = env.omsUrl;
const BACKTESTER_URL = env.backtesterUrl;

// Express app
const app = express();
app.use(cors());
app.use(express.json());
app.use(optionalBearerAuth);
app.use(tokenBucket(600));

// PostgreSQL pool for TimescaleDB
const pool = new Pool({ connectionString: TIMESCALE_DSN });

// Kafka consumer for real-time data
const kafka = new Kafka({
  clientId: 'api-gateway',
  brokers: REDPANDA_BROKERS,
});

// HTTP Server
const server = http.createServer(app);

// WebSocket Server
const wss = new WebSocketServer({ server, path: '/ws' });

// Track WebSocket subscriptions
interface ClientSubscription {
  ws: WebSocket;
  channels: Set<string>;
}

const clients = new Map<string, ClientSubscription>();

// ============================================
// REST API Routes
// ============================================

registerHealthRoutes(app);

// GET /api/instruments
app.get('/api/instruments', async (_, res) => {
  try {
    const result = await pool.query('SELECT * FROM instruments WHERE status = $1 ORDER BY symbol', ['active']);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/candles/:symbol/:interval
app.get('/api/candles/:symbol/:interval', async (req, res) => {
  const { symbol, interval } = req.params;
  const limit = parseInt(req.query.limit as string) || 500;
  try {
    const result = await pool.query(
      `SELECT c.time, c.open, c.high, c.low, c.close, c.volume, c.trade_count
       FROM candles c JOIN instruments i ON c.instrument_id = i.id
       WHERE i.symbol = $1 AND c.interval = $2 AND c.is_closed = TRUE
       ORDER BY c.time DESC LIMIT $3`,
      [symbol, interval, limit]
    );
    res.json(result.rows.reverse());
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/footprints/:symbol/:interval
app.get('/api/footprints/:symbol/:interval', async (req, res) => {
  const { symbol, interval } = req.params;
  const limit = parseInt(req.query.limit as string) || 100;
  const requestedGrouping = parseInt(req.query.tickGrouping as string);
  try {
    const minGroupingResult = await pool.query(
      `SELECT MIN(f.tick_grouping) AS tick_grouping
       FROM footprints f JOIN instruments i ON f.instrument_id = i.id
       WHERE i.symbol = $1 AND f.interval = $2`,
      [symbol, interval]
    );

    const baseGroupingValue = minGroupingResult.rows[0]?.tick_grouping;
    const baseGrouping = Number.isFinite(Number(baseGroupingValue))
      ? Number(baseGroupingValue)
      : (Number.isFinite(requestedGrouping) ? requestedGrouping : 1000);

    if (!baseGrouping) {
      res.json([]);
      return;
    }

    const targetGrouping = Number.isFinite(requestedGrouping) && requestedGrouping > baseGrouping
      ? requestedGrouping
      : baseGrouping;

    const result = await pool.query(
      `SELECT f.time, f.price_level, f.tick_grouping, f.bid_volume, f.ask_volume, f.delta, f.total_volume
       FROM footprints f JOIN instruments i ON f.instrument_id = i.id
       WHERE i.symbol = $1 AND f.interval = $2 AND f.tick_grouping = $3
       ORDER BY f.time DESC, f.price_level ASC LIMIT $4`,
      [symbol, interval, baseGrouping, limit * 80]
    );

    const candles = buildFootprintCandles(result.rows, targetGrouping);
    res.json(candles.slice(-limit));
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Proxy to OMS
app.post('/api/orders', async (req, res) => {
  try {
    const resp = await fetch(`${OMS_URL}/api/orders`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await resp.json();
    res.status(resp.status).json(data);
  } catch (err) {
    res.status(502).json({ error: 'OMS unavailable' });
  }
});

app.get('/api/orders', async (_, res) => {
  try {
    const resp = await fetch(`${OMS_URL}/api/orders`);
    res.json(await resp.json());
  } catch { res.status(502).json({ error: 'OMS unavailable' }); }
});

app.get('/api/portfolio', async (_, res) => {
  try {
    const resp = await fetch(`${OMS_URL}/api/portfolio`);
    res.json(await resp.json());
  } catch { res.status(502).json({ error: 'OMS unavailable' }); }
});

app.get('/api/positions', async (_, res) => {
  try {
    const resp = await fetch(`${OMS_URL}/api/positions`);
    res.json(await resp.json());
  } catch { res.status(502).json({ error: 'OMS unavailable' }); }
});

// Proxy to Backtester
app.post('/api/backtest/run', async (req, res) => {
  try {
    const resp = await fetch(`${BACKTESTER_URL}/api/backtest/run`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    res.json(await resp.json());
  } catch { res.status(502).json({ error: 'Backtester unavailable' }); }
});

app.get('/api/backtest/:id', async (req, res) => {
  try {
    const resp = await fetch(`${BACKTESTER_URL}/api/backtest/${req.params.id}`);
    res.json(await resp.json());
  } catch { res.status(502).json({ error: 'Backtester unavailable' }); }
});

app.get('/api/strategies', async (_, res) => {
  try {
    const resp = await fetch(`${BACKTESTER_URL}/api/strategies/`);
    res.json(await resp.json());
  } catch { res.status(502).json({ error: 'Backtester unavailable' }); }
});

// ============================================
// WebSocket Handler
// ============================================

wss.on('connection', (ws) => {
  const clientId = uuidv4();
  clients.set(clientId, { ws, channels: new Set() });
  console.log(`[WS] Client connected: ${clientId}`);

  ws.on('message', (raw) => {
    const msg = parseSubscriptionMessage(raw.toString());
    const client = clients.get(clientId);
    if (!msg || !client) return;

    if (msg.action === 'subscribe') {
      client.channels.add(msg.channel);
      ws.send(JSON.stringify({ type: 'subscribed', channel: msg.channel }));
      console.log(`[WS] ${clientId} subscribed to ${msg.channel}`);
    }

    if (msg.action === 'unsubscribe') {
      client.channels.delete(msg.channel);
      ws.send(JSON.stringify({ type: 'unsubscribed', channel: msg.channel }));
    }
  });

  ws.on('close', () => {
    clients.delete(clientId);
    console.log(`[WS] Client disconnected: ${clientId}`);
  });
});

// Broadcast to subscribed clients
function broadcast(channel: string, data: any) {
  const msg = JSON.stringify({ channel, data });
  for (const [, client] of clients) {
    if (shouldDeliver(client.channels, channel) && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(msg);
    }
  }
}

// ============================================
// Kafka Consumer → WebSocket Bridge
// ============================================

async function startKafkaBridge() {
  try {
    const consumer = kafka.consumer({ groupId: 'gateway-ws-bridge' });
    await consumer.connect();
    await consumer.subscribe({ topics: ['candles', 'footprints', 'raw_ticks', 'order_events'], fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        if (!message.value) return;
        const data = JSON.parse(message.value.toString());

        if (topic === 'candles') {
          broadcast(`candles:${data.symbol}:${data.interval}`, data);
        } else if (topic === 'footprints') {
          const enriched = enrichFootprintPayload(data);
          broadcast(`footprints:${data.symbol}:${data.interval}`, enriched);
        } else if (topic === 'raw_ticks') {
          broadcast(`ticks:${data.symbol}`, data);
        } else if (topic === 'order_events') {
          broadcast('orders', data);
        }
      },
    });

    console.log('[Kafka] Bridge started — streaming to WebSocket clients');
  } catch (err) {
    console.error('[Kafka] Bridge failed to start:', err);
    setTimeout(startKafkaBridge, 5000);
  }
}

// ============================================
// Start Server
// ============================================

server.listen(PORT, () => {
  console.log(`\n🚀 TradeLens API Gateway running on http://localhost:${PORT}`);
  console.log(`   WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`   REST API:  http://localhost:${PORT}/api\n`);
  startKafkaBridge();
});
