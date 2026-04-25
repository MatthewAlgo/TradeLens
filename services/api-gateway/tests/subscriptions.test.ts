import assert from 'node:assert/strict';
import test from 'node:test';

import { parseSubscriptionMessage, shouldDeliver } from '../src/ws/subscriptions';

test('parseSubscriptionMessage parses valid subscribe payload', () => {
  const msg = parseSubscriptionMessage('{"action":"subscribe","channel":"candles:BTCUSDT:1m"}');
  assert.equal(msg?.action, 'subscribe');
  assert.equal(msg?.channel, 'candles:BTCUSDT:1m');
});

test('parseSubscriptionMessage returns null on invalid payload', () => {
  assert.equal(parseSubscriptionMessage('not-json'), null);
  assert.equal(parseSubscriptionMessage('{"action":"noop"}'), null);
});

test('shouldDeliver matches exact subscriptions', () => {
  const channels = new Set<string>(['orders', 'ticks:BTCUSDT']);
  assert.equal(shouldDeliver(channels, 'orders'), true);
  assert.equal(shouldDeliver(channels, 'candles:BTCUSDT:1m'), false);
});
