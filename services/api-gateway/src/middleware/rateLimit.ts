import type { NextFunction, Request, Response } from 'express';

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();

export function tokenBucket(limitPerMinute = 120) {
  const refillPerMs = limitPerMinute / 60000;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();

    const bucket = buckets.get(key) || { tokens: limitPerMinute, lastRefill: now };
    const elapsed = now - bucket.lastRefill;
    bucket.tokens = Math.min(limitPerMinute, bucket.tokens + elapsed * refillPerMs);
    bucket.lastRefill = now;

    if (bucket.tokens < 1) {
      res.status(429).json({ error: 'rate limit exceeded' });
      buckets.set(key, bucket);
      return;
    }

    bucket.tokens -= 1;
    buckets.set(key, bucket);
    next();
  };
}
