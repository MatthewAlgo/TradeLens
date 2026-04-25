import assert from 'node:assert/strict';
import test from 'node:test';

import { parseBrokers } from '../src/config/env';

test('parseBrokers handles comma-separated endpoints', () => {
  const brokers = parseBrokers('redpanda:9092, localhost:19092');
  assert.deepEqual(brokers, ['redpanda:9092', 'localhost:19092']);
});

test('parseBrokers returns default when empty', () => {
  const brokers = parseBrokers('');
  assert.deepEqual(brokers, ['localhost:19092']);
});
