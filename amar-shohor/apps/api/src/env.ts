import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnvFile } from 'dotenv';
import { z } from 'zod';

/**
 * The API runs with its own workspace as the working directory, so plain
 * `dotenv/config` looks for `apps/api/.env` and silently finds nothing — every
 * setting then falls back to its default, which is invisible until something
 * that has no sensible default (like SMTP credentials) turns up missing.
 *
 * Both files are loaded, resolved from this module rather than from the cwd:
 * a workspace-local `.env` first, then the repo root. dotenv does not
 * overwrite a variable that is already set, so app-local wins over root, and
 * a real environment variable wins over both.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
loadEnvFile({ path: path.resolve(here, '..', '.env') });
loadEnvFile({ path: path.resolve(here, '..', '..', '..', '.env') });

/**
 * Config comes from the environment only. Nothing in the tree hardcodes a URL,
 * key or bucket, which is what makes phase 14 a deployment rather than a
 * rewrite. Invalid config fails at boot with a readable message instead of
 * surfacing as a confusing runtime error.
 */
/**
 * `z.coerce.boolean()` is a trap for environment variables: it runs
 * `Boolean(value)`, and `Boolean('false')` is `true`. Every flag set to
 * "false" in a .env file would read as enabled — silently, since nothing
 * errors. This parses the words people actually write.
 */
const envBool = (fallback: boolean) =>
  z
    .string()
    .optional()
    .transform((raw) => {
      if (raw === undefined || raw.trim() === '') return fallback;
      const value = raw.trim().toLowerCase();
      if (['1', 'true', 'yes', 'on'].includes(value)) return true;
      if (['0', 'false', 'no', 'off'].includes(value)) return false;
      return fallback;
    });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  API_PUBLIC_URL: z.string().url().default('http://localhost:4000'),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),

  MONGO_URL: z.string().min(1).default('mongodb://localhost:27017/amar_shohor'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters').default('dev-only-secret-do-not-ship'),
  JWT_TTL: z.string().default('7d'),

  WEB_PUBLIC_URL: z.string().url().default('http://localhost:5173'),

  /**
   * The shared secret that turns a sign-up into an authority account. Blank
   * closes staff registration entirely, which is the right default for any
   * server that is not a demo — an empty string can never match, since the
   * route checks for the code's presence before comparing it.
   */
  STAFF_SIGNUP_CODE: z.string().default(''),

  // Seeded accounts. Every seeded person gets the same password, because the
  // point of them is that a jury can sign in as any role within seconds.
  SEED_ADMIN_EMAIL: z.string().default(''),
  SEED_STAFF_EMAILS: z.string().default(''),
  SEED_PASSWORD: z.string().min(8).default('amar1234'),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default('ap-southeast-1'),
  S3_ENDPOINT: z.string().optional(),

  AI_SERVICE_URL: z.string().default('http://localhost:8000'),
  AI_ENABLED: envBool(true),

  DEDUP_AUTO_MERGE: z.coerce.number().min(0).max(1).default(0.72),
  DEDUP_REVIEW: z.coerce.number().min(0).max(1).default(0.5),
  DEDUP_RADIUS_M: z.coerce.number().default(120),
  DEDUP_WINDOW_DAYS: z.coerce.number().default(45),

  VERIFY_THRESHOLD: z.coerce.number().default(3),
  VERIFY_PROXIMITY_M: z.coerce.number().default(400),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const lines = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
  console.error(`Configuration is invalid:\n${lines.join('\n')}\n\nCopy .env.example to .env and fill it in.`);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';

if (isProd && env.JWT_SECRET === 'dev-only-secret-do-not-ship') {
  console.error('Refusing to start in production with the development JWT secret.');
  process.exit(1);
}
