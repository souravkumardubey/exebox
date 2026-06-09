import { Request, Response, NextFunction } from 'express';
import { createLogger } from '@exebox/logger';
import { getDatabase } from '@exebox/database';
import { createHash } from 'crypto';

const logger = createLogger('Auth');

declare global {
  namespace Express {
    interface Request {
      apiKeyId?: string;
      apiKeyName?: string;
    }
  }
}

export function authMiddleware(required: boolean = true) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (required) {
        return res.status(401).json({
          success: false,
          error: 'Missing or invalid Authorization header',
          message: 'Provide an API key as Bearer token',
        });
      }
      return next();
    }

    const key = authHeader.slice(7);

    if (!key.startsWith('exe_sk_')) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key format',
      });
    }

    const keyHash = createHash('sha256').update(key).digest('hex');

    try {
      const db = getDatabase();
      const apiKey = await db.apiKey.findUnique({
        where: { keyHash },
      });

      if (!apiKey || apiKey.revoked) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or revoked API key',
        });
      }

      await db.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      });

      req.apiKeyId = apiKey.id;
      req.apiKeyName = apiKey.name;
      next();
    } catch (error: any) {
      logger.error(error, 'Auth middleware error');
      return res.status(500).json({
        success: false,
        error: 'Authentication service error',
      });
    }
  };
}
