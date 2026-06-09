import { Request, Response, NextFunction } from 'express';
import { createLogger } from '@exebox/logger';

const logger = createLogger('RateLimit');

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000');
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX || '60');

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const key = req.apiKeyId || req.ip || 'anonymous';
  const now = Date.now();

  let entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    store.set(key, entry);
  }

  entry.count++;

  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS - entry.count));
  res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

  if (entry.count > MAX_REQUESTS) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests',
      message: `Rate limit exceeded. Try again after ${new Date(entry.resetAt).toISOString()}`,
    });
  }

  next();
}

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}, 300000).unref();
