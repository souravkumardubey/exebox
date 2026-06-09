import express from 'express';
import { createLogger } from '@exebox/logger';

const logger = createLogger('WorkerHealth');
const app = express();
const PORT = parseInt(process.env.WORKER_HEALTH_PORT || '4003');

app.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', service: 'exebox-worker' } });
});

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Worker health server listening');
});

export default app;
