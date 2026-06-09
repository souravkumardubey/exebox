import { Router, Request, Response } from 'express';
import { createLogger } from '@exebox/logger';
import { getDatabase } from '@exebox/database';
import { addExecutionJob } from '@exebox/queue';
import { createSessionSchema, sessionExecSchema } from '../dto/schemas';
import { authMiddleware } from '../middleware/auth';

const logger = createLogger('SessionRoute');
const router = Router();

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

router.post('/', authMiddleware(), async (req: Request, res: Response) => {
  try {
    const parsed = createSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: parsed.error.errors.map((e) => e.message),
      });
    }

    const { language } = parsed.data;
    const db = getDatabase();

    const session = await db.session.create({
      data: {
        apiKeyId: req.apiKeyId,
        language,
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });

    logger.info({ sessionId: session.id, language }, 'Session created');

    return res.status(201).json({
      success: true,
      data: {
        sessionId: session.id,
        language,
        status: 'active',
        expiresAt: session.expiresAt.toISOString(),
      },
    });
  } catch (error: any) {
    logger.error(error, 'Failed to create session');
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

router.post('/:id/exec', authMiddleware(), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const parsed = sessionExecSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: parsed.error.errors.map((e) => e.message),
      });
    }

    const { code, stdin } = parsed.data;
    const db = getDatabase();

    const session = await db.session.findUnique({
      where: { id },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
      });
    }

    if (session.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        error: `Session is ${session.status.toLowerCase()}`,
      });
    }

    if (!session.containerId) {
      return res.status(400).json({
        success: false,
        error: 'Session container not yet initialized. Try again shortly.',
      });
    }

    const execution = await db.execution.create({
      data: {
        apiKeyId: req.apiKeyId,
        language: session.language,
        sourceCode: code,
        stdin,
        status: 'PENDING',
        sessionId: session.id,
      },
    });

    await addExecutionJob({
      executionId: execution.id,
      language: session.language,
      sourceCode: code,
      stdin,
      apiKeyId: req.apiKeyId,
      sessionId: session.id,
      timestamp: Date.now(),
    });

    await db.execution.update({
      where: { id: execution.id },
      data: { status: 'QUEUED' },
    });

    return res.status(201).json({
      success: true,
      data: {
        executionId: execution.id,
        status: 'queued',
        sessionId: session.id,
      },
    });
  } catch (error: any) {
    logger.error(error, 'Failed to execute in session');
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

    const session = await db.session.findUnique({
      where: { id },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
      });
    }

    await db.session.update({
      where: { id },
      data: { status: 'DESTROYED' },
    });

    logger.info({ sessionId: id }, 'Session marked for destruction');

    return res.json({
      success: true,
      data: { status: 'destroyed' },
    });
  } catch (error: any) {
    logger.error(error, 'Failed to destroy session');
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export default router;
