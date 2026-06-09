import { getDatabase } from '@exebox/database';
import { createLogger } from '@exebox/logger';
import { destroySessionContainer } from './session-manager';

const logger = createLogger('Reaper');

const REAP_INTERVAL_MS = parseInt(process.env.REAP_INTERVAL_MS || '300000');

export function startSessionReaper() {
  const reaper = async () => {
    try {
      const db = getDatabase();
      const expired = await db.session.findMany({
        where: {
          status: { in: ['ACTIVE', 'IDLE'] },
          expiresAt: { lte: new Date() },
        },
      });

      for (const session of expired) {
        try {
          await destroySessionContainer(session.id);
          logger.info({ sessionId: session.id }, 'Session reaped');
        } catch (err: any) {
          logger.error({ sessionId: session.id, err: err.message }, 'Failed to reap session');
        }
      }
    } catch (err: any) {
      logger.error({ err: err.message }, 'Reaper cycle failed');
    }
  };

  setInterval(reaper, REAP_INTERVAL_MS).unref();
  logger.info({ intervalMs: REAP_INTERVAL_MS }, 'Session reaper started');
}
