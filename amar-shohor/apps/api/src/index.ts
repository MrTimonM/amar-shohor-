import path from 'node:path';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { aiHealth, queueDepth } from './ai';
import { attachUser } from './auth';
import { connectDb } from './db';
import { env } from './env';
import { errorHandler } from './http';
import { log } from './log';
import { adminRouter } from './routes/admin';
import { authorityRouter } from './routes/authority';
import { authRouter } from './routes/auth';
import { issuesRouter } from './routes/issues';
import { mediaRouter } from './routes/media';
import { reportsRouter } from './routes/reports';
import { statsRouter } from './routes/stats';
import { storage, uploadRoot } from './storage';

const app = express();

app.set('trust proxy', 1);
app.use(
  helmet({
    // The API only serves JSON and images; the web app is a separate origin.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  }),
);
app.use(cors({ origin: env.WEB_ORIGIN.split(',').map((o) => o.trim()), credentials: false }));
app.use(express.json({ limit: '1mb' }));
app.use(
  morgan(':method :url :status :response-time ms', {
    stream: { write: (line) => log.debug(line.trim()) },
    skip: (req) => req.path === '/health',
  }),
);
app.use(attachUser);

// Locally the uploads directory is served directly; on S3 CloudFront does it.
if (storage.driver === 'local') {
  app.use('/uploads', express.static(uploadRoot, { maxAge: '30d', immutable: true, fallthrough: true }));
}

app.get('/health', async (_req, res) => {
  const ai = await aiHealth();
  res.json({
    ok: true,
    service: 'amar-shohor-api',
    env: env.NODE_ENV,
    storage: storage.driver,
    queueDepth: queueDepth(),
    ai,
  });
});

app.use('/v1/auth', authRouter);
app.use('/v1/media', mediaRouter);
app.use('/v1/reports', reportsRouter);
app.use('/v1/issues', issuesRouter);
app.use('/v1/authority', authorityRouter);
app.use('/v1/admin', adminRouter);
app.use('/v1/stats', statsRouter);

app.use((_req, res) => res.status(404).json({ error: 'not_found', message: 'No such endpoint' }));
app.use(errorHandler);

async function main() {
  await connectDb();

  const server = app.listen(env.PORT, () => {
    log.info('api listening', { port: env.PORT, url: env.API_PUBLIC_URL, uploads: path.relative(process.cwd(), uploadRoot) });
  });

  // Finish in-flight requests before exiting so a deploy does not drop a
  // citizen's report mid-submit.
  const shutdown = (signal: string) => {
    log.info('shutting down', { signal });
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

void main();
