import type { Express } from 'express';

export function registerHealthRoutes(app: Express, clients?: Map<string, any>) {
  app.get('/health', (_req, res) => {
    let totalSubs = 0;
    if (clients) {
      for (const [, client] of clients) {
        totalSubs += client.channels.size;
      }
    }

    res.json({
      status: 'ok',
      service: 'api-gateway',
      active_ws_clients: clients ? clients.size : 0,
      total_subscriptions: totalSubs
    });
  });
}
