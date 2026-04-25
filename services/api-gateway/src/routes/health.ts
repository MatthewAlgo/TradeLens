import type { Express } from 'express';

export function registerHealthRoutes(app: Express) {
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'api-gateway' });
  });
}
