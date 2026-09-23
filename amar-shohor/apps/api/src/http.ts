import type { NextFunction, Request, Response } from 'express';
import { ZodError, type TypeOf, type ZodTypeAny } from 'zod';
import { log } from './log';

/** Errors thrown anywhere in a route land here with a real status code. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
  static badRequest = (msg: string, fields?: Record<string, string>) => new HttpError(400, 'bad_request', msg, fields);
  static unauthorized = (msg = 'Sign in to continue') => new HttpError(401, 'unauthorized', msg);
  static forbidden = (msg = 'You do not have access to this') => new HttpError(403, 'forbidden', msg);
  static notFound = (msg = 'Not found') => new HttpError(404, 'not_found', msg);
  static conflict = (msg: string) => new HttpError(409, 'conflict', msg);
  static tooMany = (msg = 'Too many attempts. Wait a minute and try again.') => new HttpError(429, 'rate_limited', msg);
}

/** Wraps an async handler so a rejected promise reaches the error middleware. */
export const route =
  <T>(fn: (req: Request, res: Response) => Promise<T>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

/**
 * Validates and returns typed *output*, turning Zod issues into field
 * messages. Inferring from the schema rather than a bare `T` matters: with
 * `ZodSchema<T>` TypeScript picks up Zod's input type, where a field with a
 * `.default()` still looks optional, and every defaulted field then reads as
 * possibly undefined at the call site.
 */
export function parse<S extends ZodTypeAny>(schema: S, data: unknown): TypeOf<S> {
  try {
    return schema.parse(data) as TypeOf<S>;
  } catch (err) {
    if (err instanceof ZodError) {
      const fields: Record<string, string> = {};
      for (const issue of err.issues) {
        const key = issue.path.join('.') || '_';
        if (!fields[key]) fields[key] = issue.message;
      }
      throw HttpError.badRequest('Some fields need fixing', fields);
    }
    throw err;
  }
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.code, message: err.message, fields: err.fields });
    return;
  }
  // Duplicate key on a unique index — surface it as a conflict, not a 500.
  if (typeof err === 'object' && err && (err as { code?: number }).code === 11000) {
    res.status(409).json({ error: 'conflict', message: 'That already exists' });
    return;
  }
  log.error('unhandled error', { path: req.path, method: req.method, err: String(err), stack: (err as Error)?.stack });
  res.status(500).json({ error: 'internal', message: 'Something broke on our side. Try again in a moment.' });
}

/** Six characters, no vowels and no 0/O/1/I — safe to read over a phone. */
const REF_ALPHABET = '23456789BCDFGHJKLMNPQRSTVWXZ';
export function makeRef(prefix: 'AS' | 'RP'): string {
  let out = '';
  for (let i = 0; i < 6; i += 1) {
    out += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)];
  }
  return `${prefix}-${out}`;
}
