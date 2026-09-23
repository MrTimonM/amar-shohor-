import { env } from './env';

/**
 * Structured JSON logging from the first commit, so CloudWatch Insights can
 * query it in phase 14 without a log-format migration.
 */
type Level = 'debug' | 'info' | 'warn' | 'error';

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN = ORDER[env.NODE_ENV === 'development' ? 'debug' : 'info'];

function emit(level: Level, msg: string, fields?: Record<string, unknown>) {
  if (ORDER[level] < MIN) return;
  const line = { ts: new Date().toISOString(), level, msg, ...fields };
  const out = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
  out.write(`${JSON.stringify(line)}\n`);
}

export const log = {
  debug: (msg: string, fields?: Record<string, unknown>) => emit('debug', msg, fields),
  info: (msg: string, fields?: Record<string, unknown>) => emit('info', msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => emit('warn', msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => emit('error', msg, fields),
};
