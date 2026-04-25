import type { NextFunction, Request, Response } from 'express';

export function optionalBearerAuth(req: Request, _res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth) {
    return next();
  }

  if (!auth.toLowerCase().startsWith('bearer ')) {
    return next();
  }

  // JWT verification can be upgraded in a dedicated auth phase.
  return next();
}
