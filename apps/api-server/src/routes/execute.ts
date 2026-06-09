import { Router, Request, Response } from 'express';
import { createLogger } from '@exebox/logger';
import { getDatabase } from '@exebox/database';
import { addExecutionJob } from '@exebox/queue';
import { SUPPORTED_LANGUAGES } from '@exebox/shared';
import { createExecutionSchema, batchExecutionSchema } from '../dto/schemas';
import { authMiddleware } from '../middleware/auth';

const logger = createLogger('ExecuteRoute');
const router = Router();

router.post('/', authMiddleware(), async (req: Request, res: Response) => {
  try {
    const parsed = createExecutionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: parsed.error.errors.map((e) => e.message),
      });
    }

    const { language, sourceCode, stdin, timeout } = parsed.data;
    const db = getDatabase();

    const execution = await db.execution.create({
      data: {
        apiKeyId: req.apiKeyId,
        language,
        sourceCode,
        stdin,
        status: 'PENDING',
      },
    });

    await addExecutionJob({
      executionId: execution.id,
      language,
      sourceCode,
      stdin,
      apiKeyId: req.apiKeyId,
      timestamp: Date.now(),
    });

    await db.execution.update({
      where: { id: execution.id },
      data: { status: 'QUEUED' },
    });

    logger.info({ executionId: execution.id, language }, 'Execution created and queued');

    return res.status(201).json({
      success: true,
      data: {
        executionId: execution.id,
        status: 'queued',
      },
    });
  } catch (error: any) {
    logger.error(error, 'Failed to create execution');
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

router.post('/batch', authMiddleware(), async (req: Request, res: Response) => {
  try {
    const parsed = batchExecutionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: parsed.error.errors.map((e) => e.message),
      });
    }

    const { language, sourceCode, stdin, testCases } = parsed.data;
    const db = getDatabase();

    const execution = await db.execution.create({
      data: {
        apiKeyId: req.apiKeyId,
        language,
        sourceCode,
        stdin,
        status: 'PENDING',
      },
    });

    await addExecutionJob({
      executionId: execution.id,
      language,
      sourceCode,
      stdin,
      testCases: testCases.map((tc) => ({
        input: tc.input || '',
        expectedOutput: tc.expectedOutput,
        hidden: tc.hidden,
      })),
      apiKeyId: req.apiKeyId,
      timestamp: Date.now(),
    });

    await db.execution.update({
      where: { id: execution.id },
      data: { status: 'QUEUED' },
    });

    logger.info({ executionId: execution.id, language, testCaseCount: testCases.length }, 'Batch execution created');

    return res.status(201).json({
      success: true,
      data: {
        executionId: execution.id,
        status: 'queued',
        testCaseCount: testCases.length,
      },
    });
  } catch (error: any) {
    logger.error(error, 'Failed to create batch execution');
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export default router;
