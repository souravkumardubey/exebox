import { Router, Request, Response } from 'express';
import { createLogger } from '@exebox/logger';
import { getDatabase } from '@exebox/database';
import { authMiddleware } from '../middleware/auth';
import { paginationSchema } from '../dto/schemas';

const logger = createLogger('ExecutionRoute');
const router = Router();

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const db = getDatabase();

    const execution = await db.execution.findUnique({
      where: { id },
      select: {
        id: true,
        language: true,
        status: true,
        stdout: true,
        stderr: true,
        runtimeMs: true,
        memoryKb: true,
        exitCode: true,
        error: true,
        testResults: true,
        createdAt: true,
      },
    });

    if (!execution) {
      return res.status(404).json({
        success: false,
        error: 'Execution not found',
      });
    }

    return res.json({
      success: true,
      data: execution,
    });
  } catch (error: any) {
    logger.error(error, 'Failed to get execution');
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

router.get('/', authMiddleware(false), async (req: Request, res: Response) => {
  try {
    const parsed = paginationSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid pagination params',
        message: parsed.error.errors.map((e) => e.message),
      });
    }

    const { page, limit } = parsed.data;
    const skip = (page - 1) * limit;
    const db = getDatabase();

    const where = req.apiKeyId ? { apiKeyId: req.apiKeyId } : {};
    const [data, total] = await Promise.all([
      db.execution.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          language: true,
          status: true,
          runtimeMs: true,
          memoryKb: true,
          exitCode: true,
          createdAt: true,
        },
      }),
      db.execution.count({ where }),
    ]);

    return res.json({
      success: true,
      data: {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    logger.error(error, 'Failed to list executions');
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export default router;
