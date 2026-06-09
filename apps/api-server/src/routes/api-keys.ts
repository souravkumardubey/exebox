import { Router, Request, Response } from 'express';
import { createHash, randomBytes } from 'crypto';
import { createLogger } from '@exebox/logger';
import { getDatabase } from '@exebox/database';
import { authMiddleware } from '../middleware/auth';
import { z } from 'zod';

const logger = createLogger('ApiKeysRoute');
const router = Router();

const createKeySchema = z.object({
  name: z.string().min(1).max(100),
});

router.post('/', authMiddleware(), async (req: Request, res: Response) => {
  try {
    const parsed = createKeySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: parsed.error.errors.map((e) => e.message),
      });
    }

    const { name } = parsed.data;
    const prefix = name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 12);
    const random = randomBytes(24).toString('base64url');
    const key = `exe_sk_${prefix}_${random}`;
    const keyHash = createHash('sha256').update(key).digest('hex');

    const db = getDatabase();
    await db.apiKey.create({
      data: { name, keyPrefix: prefix, keyHash },
    });

    logger.info({ keyPrefix: prefix }, 'API key created');

    return res.status(201).json({
      success: true,
      data: { key, name, keyPrefix: prefix },
    });
  } catch (error: any) {
    logger.error(error, 'Failed to create API key');
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

router.get('/', authMiddleware(), async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const keys = await db.apiKey.findMany({
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        lastUsedAt: true,
        createdAt: true,
        revoked: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, data: keys });
  } catch (error: any) {
    logger.error(error, 'Failed to list API keys');
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

router.delete('/:id', authMiddleware(), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const db = getDatabase();

    const existing = await db.apiKey.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'API key not found',
      });
    }

    await db.apiKey.update({
      where: { id },
      data: { revoked: true },
    });

    logger.info({ keyId: id, name: existing.name }, 'API key revoked');

    return res.json({ success: true, data: { status: 'revoked' } });
  } catch (error: any) {
    logger.error(error, 'Failed to revoke API key');
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export default router;
