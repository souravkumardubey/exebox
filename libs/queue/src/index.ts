import { Queue, Worker, Job } from 'bullmq';
import { createLogger } from '@exebox/logger';
import { QUEUE_NAMES } from '@exebox/shared';
import type { QueueJobData } from '@exebox/shared';

const logger = createLogger('Queue');

const connection = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

let executionQueue: Queue;
let executionWorker: Worker;

export function getExecutionQueue(): Queue {
  if (!executionQueue) {
    executionQueue = new Queue(QUEUE_NAMES.EXECUTION, {
      connection,
      defaultJobOptions: {
        attempts: parseInt(process.env.QUEUE_RETRY_ATTEMPTS || '3'),
        backoff: {
          type: 'exponential',
          delay: parseInt(process.env.QUEUE_RETRY_DELAY || '1000'),
        },
        removeOnComplete: {
          age: 3600,
          count: 1000,
        },
        removeOnFail: {
          age: 86400,
          count: 100,
        },
      },
    });
    logger.info('Execution queue initialized');
  }
  return executionQueue;
}

export function createExecutionWorker(
  processor: (job: Job<QueueJobData>) => Promise<void>,
): Worker {
  if (executionWorker) {
    return executionWorker;
  }

  executionWorker = new Worker<QueueJobData>(QUEUE_NAMES.EXECUTION, processor, {
    connection,
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5'),
    lockDuration: 60000,
    stalledInterval: 30000,
    maxStalledCount: 2,
  });

  executionWorker.on('completed', (job) => {
    logger.info({ jobId: job.id, executionId: job.data.executionId }, 'Job completed');
  });

  executionWorker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, executionId: job?.data.executionId, error: err.message },
      'Job failed',
    );
  });

  executionWorker.on('active', (job) => {
    logger.info({ jobId: job.id, executionId: job.data.executionId }, 'Job started');
  });

  executionWorker.on('progress', (job, progress) => {
    logger.debug({ jobId: job.id, progress }, 'Job progress');
  });

  executionWorker.on('error', (err) => {
    logger.error(err, 'Worker error');
  });

  logger.info('Execution worker initialized');
  return executionWorker;
}

export async function addExecutionJob(
  data: QueueJobData,
): Promise<Job<QueueJobData>> {
  const queue = getExecutionQueue();
  const job = await queue.add(QUEUE_NAMES.EXECUTION, data, {
    jobId: data.executionId,
    priority: 1,
    timestamp: Date.now(),
  });
  logger.info({ jobId: job.id, executionId: data.executionId }, 'Job added to queue');
  return job;
}

export async function getQueueMetrics(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  const queue = getExecutionQueue();
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);
  return { waiting, active, completed, failed, delayed };
}

export async function gracefulShutdown(): Promise<void> {
  if (executionWorker) {
    await executionWorker.close();
    logger.info('Worker closed');
  }
  if (executionQueue) {
    await executionQueue.close();
    logger.info('Queue closed');
  }
}
