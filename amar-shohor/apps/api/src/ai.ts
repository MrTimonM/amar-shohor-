import { CATEGORIES, type Category } from '@amar/shared';
import { env } from './env';
import { log } from './log';

/**
 * Phase 08 — the client side of the AI platform.
 *
 * Two rules hold this shape:
 *   1. Inference is asynchronous. A submit writes the report and enqueues a
 *      job. If the AI service is down, the report still succeeds and gets
 *      enriched later — a citizen never waits on a model.
 *   2. Every prediction records which model version produced it, so a bad
 *      rollout can be found and reversed.
 *
 * The queue below is an in-process worker. It is the seam that phase 14 points
 * at SQS: `enqueue` is the only function that changes.
 */

export interface VisionResult {
  model: string;
  category: Category;
  categoryConfidence: number;
  severity: number;
  relevant: boolean;
  /** Unit-length vector used by the dedup engine (phase 10). */
  embedding: number[];
  integrity: {
    screenshotSuspected: boolean;
    reusedImage: boolean;
  };
}

const AI_TIMEOUT_MS = 6_000;

export async function analysePhoto(input: {
  imageUrl: string;
  reportedCategory?: Category;
  description?: string;
}): Promise<VisionResult | null> {
  if (!env.AI_ENABLED) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const res = await fetch(`${env.AI_SERVICE_URL}/v1/analyse`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        image_url: input.imageUrl,
        reported_category: input.reportedCategory ?? null,
        description: input.description ?? null,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      log.warn('ai service returned an error', { status: res.status });
      return null;
    }

    const body = (await res.json()) as {
      model: string;
      category: string;
      category_confidence: number;
      severity: number;
      relevant: boolean;
      embedding: number[];
      integrity?: { screenshot_suspected?: boolean; reused_image?: boolean };
    };

    if (!CATEGORIES.includes(body.category as Category)) {
      log.warn('ai service returned an unknown category', { category: body.category });
      return null;
    }

    return {
      model: body.model,
      category: body.category as Category,
      categoryConfidence: body.category_confidence,
      severity: body.severity,
      relevant: body.relevant,
      embedding: body.embedding ?? [],
      integrity: {
        screenshotSuspected: body.integrity?.screenshot_suspected ?? false,
        reusedImage: body.integrity?.reused_image ?? false,
      },
    };
  } catch (err) {
    // Expected whenever the service is not running. Not an error condition for
    // the API — the report is already saved.
    log.debug('ai service unreachable', { err: String(err) });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function aiHealth(): Promise<{ up: boolean; models?: string[] }> {
  if (!env.AI_ENABLED) return { up: false };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${env.AI_SERVICE_URL}/health`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return { up: false };
    const body = (await res.json()) as { models?: string[] };
    return { up: true, models: body.models };
  } catch {
    return { up: false };
  }
}

// --- Job queue --------------------------------------------------------------

type Job = () => Promise<void>;

const pending: Job[] = [];
let running = 0;
const CONCURRENCY = 2;

/**
 * Enqueue background work. The only function phase 14 rewrites to publish to
 * SQS instead — every caller stays the same.
 */
export function enqueue(name: string, job: Job): void {
  pending.push(async () => {
    const started = Date.now();
    try {
      await job();
      log.debug('job done', { job: name, ms: Date.now() - started });
    } catch (err) {
      log.error('job failed', { job: name, err: String(err) });
    }
  });
  drain();
}

function drain(): void {
  while (running < CONCURRENCY && pending.length > 0) {
    const job = pending.shift();
    if (!job) return;
    running += 1;
    void job().finally(() => {
      running -= 1;
      drain();
    });
  }
}

export const queueDepth = () => pending.length + running;

// --- Vector helpers ---------------------------------------------------------

/** Cosine similarity. Both vectors are expected unit-length already. */
export function cosine(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Running mean of an issue's member embeddings, kept unit-length. */
export function meanVector(vectors: number[][]): number[] | undefined {
  const usable = vectors.filter((v) => v.length > 0);
  const first = usable[0];
  if (!first) return undefined;
  const out = new Array<number>(first.length).fill(0);
  for (const v of usable) {
    if (v.length !== out.length) continue;
    for (let i = 0; i < out.length; i += 1) out[i] = (out[i] ?? 0) + (v[i] ?? 0);
  }
  const norm = Math.sqrt(out.reduce((s, x) => s + x * x, 0));
  if (norm === 0) return undefined;
  return out.map((x) => x / norm);
}
