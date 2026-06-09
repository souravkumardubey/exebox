import { Request, Response, NextFunction } from 'express';
import { createLogger } from '@exebox/logger';

const logger = createLogger('ErrorHandler');

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  const statusCode = err.statusCode || err.status || 500;

  if (statusCode >= 500) {
    logger.error({ err, statusCode }, 'Internal server error');
  } else {
    logger.warn({ err, statusCode }, 'Request error');
  }

  const body = {
    success: false,
    error: statusCode >= 500 ? 'Internal server error' : err.message || 'Unknown error',
  };

  if (statusCode >= 500 && process.env.NODE_ENV !== 'production') {
    (body as any).detail = err.stack;
  }

  return res.status(statusCode).json(body);
}
