import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { createLogger } from '@exebox/logger';

const logger = createLogger('RateLimit');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000');
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX || '60');

const redis = new Redis(REDIS_URL, { keyPrefix: 'exebox:ratelimit:', enableOfflineQueue: false });

redis.on('error', (err) => {
  logger.warn({ err: err.message }, 'Rate limiter Redis unavailable, falling back to pass-through');
});

export async function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const key = req.apiKeyId || req.ip || 'anonymous';
  const now = Date.now();

  try {
    const windowStart = now - WINDOW_MS;
    const member = `${req.ip}:${now}`;

    await redis.zadd(key, now, member);
    await redis.zremrangebyscore(key, 0, windowStart);

    const count = await redis.zcard(key);

    await redis.expire(key, Math.ceil(WINDOW_MS / 1000));

    const remaining = Math.max(0, MAX_REQUESTS - count);

    res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil((now + WINDOW_MS) / 1000));

    if (count > MAX_REQUESTS) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests',
        message: 'Rate limit exceeded. Try again later.',
      });
    }

    next();
  } catch {
    next();
  }
}
