import { Server as HTTPServer } from 'http';
import { Server } from 'socket.io';
import Redis from 'ioredis';
import { createHash } from 'crypto';
import { createLogger } from '@exebox/logger';
import { EXECUTION_EVENTS } from '@exebox/shared';

const logger = createLogger('WS');

const PORT = parseInt(process.env.WS_PORT || '4001');
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const pub = new Redis(REDIS_URL);
const sub = new Redis(REDIS_URL);

const httpServer = new HTTPServer();
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
});

io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;

  if (!token || typeof token !== 'string' || !token.startsWith('exe_sk_')) {
    return next(new Error('Invalid API key'));
  }

  const keyHash = createHash('sha256').update(token).digest('hex');

  try {
    const redis = new Redis(REDIS_URL);
    const valid = await redis.sismember('exebox:api_keys', keyHash);
    await redis.quit();

    if (!valid) {
      return next(new Error('Invalid or revoked API key'));
    }

    (socket as any).apiKeyHash = keyHash;
    next();
  } catch {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  logger.info({ socketId: socket.id }, 'Client connected');

  socket.on('subscribe:execution', (executionId: string) => {
    if (!executionId || typeof executionId !== 'string') return;
    socket.join(`execution:${executionId}`);
    logger.info({ socketId: socket.id, executionId }, 'Subscribed to execution');
  });

  socket.on('subscribe:session', (sessionId: string) => {
    if (!sessionId || typeof sessionId !== 'string') return;
    socket.join(`session:${sessionId}`);
    logger.info({ socketId: socket.id, sessionId }, 'Subscribed to session');
  });

  socket.on('unsubscribe:execution', (executionId: string) => {
    if (!executionId || typeof executionId !== 'string') return;
    socket.leave(`execution:${executionId}`);
  });

  socket.on('unsubscribe:session', (sessionId: string) => {
    if (!sessionId || typeof sessionId !== 'string') return;
    socket.leave(`session:${sessionId}`);
  });

  socket.on('disconnect', () => {
    logger.info({ socketId: socket.id }, 'Client disconnected');
  });
});

sub.subscribe(EXECUTION_EVENTS.OUTPUT, EXECUTION_EVENTS.COMPLETED, EXECUTION_EVENTS.ERROR);

sub.on('message', (channel, message) => {
  try {
    const payload = JSON.parse(message);
    const { executionId, sessionId, type, data } = payload;

    if (executionId) {
      io.to(`execution:${executionId}`).emit(channel, data);
    }

    if (sessionId) {
      io.to(`session:${sessionId}`).emit(channel, data);
    }

    if (!executionId && !sessionId) {
      logger.warn({ channel, message }, 'No target for WS event');
    }
  } catch (err: any) {
    logger.error(err, 'Failed to forward WS message');
  }
});

httpServer.listen(PORT, () => {
  logger.info({ port: PORT }, 'WebSocket server listening');
});

function gracefulShutdown(signal: string) {
  logger.info({ signal }, 'Shutdown signal received');
  io.close();
  pub.disconnect();
  sub.disconnect();
  httpServer.close(() => {
    logger.info('WS server closed');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
