import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createLogger } from '@exebox/logger';
import executeRoutes from './routes/execute';
import sessionRoutes from './routes/session';
import executionRoutes from './routes/execution';
import languageRoutes from './routes/languages';
import { rateLimitMiddleware } from './middleware/rate-limit';

const logger = createLogger('API');

const app = express();
const PORT = parseInt(process.env.API_PORT || '4000');

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(rateLimitMiddleware);

app.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', service: 'exebox-api' } });
});

app.use('/v1/execute', executeRoutes);
app.use('/v1/sessions', sessionRoutes);
app.use('/v1/executions', executionRoutes);
app.use('/v1/languages', languageRoutes);

app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, 'API server listening');
});

function gracefulShutdown(signal: string) {
  logger.info({ signal }, 'Shutdown signal received');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
