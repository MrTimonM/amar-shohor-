import { api } from './api';

/**
 * Phase 05 — the offline queue.
 *
 * A report written on a dead connection is held in IndexedDB with its photo
 * blobs intact and flushed when the network returns. Nothing a citizen typed
 * or photographed is ever lost, which is the difference between a product that
 * works in Dhaka and a demo that works on a desk.
 */

const DB_NAME = 'amar-shohor';
const DB_VERSION = 1;
const STORE = 'queued-reports';

export interface QueuedReport {
  id: string;
  category: string;
  severity?: number;
  description?: string;
  lat: number;
  lng: number;
  accuracy?: number;
  confirmsIssueId?: string;
  photos: Blob[];
  createdAt: number;
  attempts: number;
  lastError?: string;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = fn(transaction.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

export const queueReport = async (draft: Omit<QueuedReport, 'id' | 'createdAt' | 'attempts'>): Promise<QueuedReport> => {
  const entry: QueuedReport = { ...draft, id: crypto.randomUUID(), createdAt: Date.now(), attempts: 0 };
  await tx('readwrite', (store) => store.put(entry));
  return entry;
};

export const listQueued = () => tx<QueuedReport[]>('readonly', (store) => store.getAll() as IDBRequest<QueuedReport[]>);

export const removeQueued = (id: string) => tx('readwrite', (store) => store.delete(id));

const updateQueued = (entry: QueuedReport) => tx('readwrite', (store) => store.put(entry));

export interface FlushResult {
  sent: number;
  failed: number;
  remaining: number;
}

/**
 * Attempts every queued report once. A report that fails five times stays in
 * the queue but stops being retried automatically — silently dropping it would
 * be worse, and the citizen can see it listed as unsent.
 */
export async function flushQueue(): Promise<FlushResult> {
  if (typeof indexedDB === 'undefined') return { sent: 0, failed: 0, remaining: 0 };

  const queued = await listQueued();
  let sent = 0;
  let failed = 0;

  for (const entry of queued) {
    if (entry.attempts >= 5) continue;
    try {
      const files = entry.photos.map((blob, i) => new File([blob], `report-${i}.webp`, { type: blob.type || 'image/webp' }));
      const { photos } = await api.uploadPhotos(files);
      await api.createReport({
        category: entry.category,
        severity: entry.severity,
        description: entry.description,
        location: { type: 'Point', coordinates: [entry.lng, entry.lat] },
        accuracy: entry.accuracy,
        photoIds: photos.map((p) => p.id),
        confirmsIssueId: entry.confirmsIssueId,
        queuedOffline: true,
      });
      await removeQueued(entry.id);
      sent += 1;
    } catch (err) {
      failed += 1;
      await updateQueued({ ...entry, attempts: entry.attempts + 1, lastError: String(err) });
    }
  }

  const remaining = (await listQueued()).length;
  return { sent, failed, remaining };
}

/** Flushes on reconnect and once at startup. */
export function watchConnection(onFlush: (result: FlushResult) => void): () => void {
  const run = () => {
    void flushQueue().then((result) => {
      if (result.sent > 0 || result.failed > 0) onFlush(result);
    });
  };
  window.addEventListener('online', run);
  if (navigator.onLine) run();
  return () => window.removeEventListener('online', run);
}
