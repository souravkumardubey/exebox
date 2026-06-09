import express from 'express';
import { createLogger } from '@exebox/logger';

const logger = createLogger('WSHealth');
const app = express();
const PORT = parseInt(process.env.WS_HEALTH_PORT || '4004');

app.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', service: 'exebox-ws' } });
});

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'WS health server listening');
});

export default app;
