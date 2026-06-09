import { PrismaClient } from '@prisma/client';
import { createLogger } from '@exebox/logger';

const logger = createLogger('Database');

let prisma: PrismaClient;

export function getDatabase(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: [
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
        ...(process.env.NODE_ENV === 'development'
          ? [{ emit: 'event' as const, level: 'query' as const }]
          : []),
      ],
    });

    prisma.$on('error' as never, (e: any) => {
      logger.error({ message: e.message, target: e.target }, 'Database error');
    });

    prisma.$on('warn' as never, (e: any) => {
      logger.warn({ message: e.message, target: e.target }, 'Database warning');
    });

    if (process.env.NODE_ENV === 'development') {
      prisma.$on('query' as never, (e: any) => {
        logger.debug(
          { query: e.query, params: e.params, duration: e.duration },
          'Database query',
        );
      });
    }
  }

  return prisma;
}

export async function connectDatabase(): Promise<void> {
  try {
    await getDatabase().$connect();
    logger.info('Database connected successfully');
  } catch (error: any) {
    logger.error(error, 'Failed to connect to database');
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    logger.info('Database disconnected');
  }
}
