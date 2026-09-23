import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from './env';
import { HttpError } from './http';
import { log } from './log';

/**
 * Phase 06 — the media pipeline.
 *
 * Everything above this file talks to `storage`, never to a filesystem or an
 * SDK. Swapping MinIO/local for S3 in phase 14 is a change to STORAGE_DRIVER
 * and nothing else.
 */

export interface StoredPhoto {
  id: string;
  key: string;
  url: string;
  thumbUrl: string;
  width?: number;
  height?: number;
  bytes: number;
  exif?: { capturedAt?: Date; lat?: number; lng?: number; make?: string; model?: string };
}

export interface StorageAdapter {
  readonly driver: 'local' | 's3';
  put(file: { buffer: Buffer; mimetype: string; originalname: string }): Promise<StoredPhoto>;
  remove(key: string): Promise<void>;
}

const ALLOWED = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/heic', 'heic'],
]);

/** Magic bytes, because a client-supplied MIME type proves nothing. */
function sniff(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buf.subarray(4, 8).toString('ascii') === 'ftyp') return 'image/heic';
  return null;
}

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

export function validateUpload(file: { buffer: Buffer; mimetype: string }): string {
  if (file.buffer.length > MAX_UPLOAD_BYTES) {
    throw HttpError.badRequest('That image is over 12MB. The app compresses photos before upload — try re-taking it.');
  }
  const sniffed = sniff(file.buffer);
  if (!sniffed || !ALLOWED.has(sniffed)) {
    throw HttpError.badRequest('Only JPEG, PNG, WebP or HEIC photos are accepted.');
  }
  return sniffed;
}

/**
 * sharp is an optional dependency: it produces the WebP derivatives and reads
 * EXIF, but a machine that cannot build it still runs the app with originals
 * served directly. Degrading is better than failing to install.
 */
type Sharp = typeof import('sharp');
let sharpModule: Sharp | null | undefined;

async function getSharp(): Promise<Sharp | null> {
  if (sharpModule !== undefined) return sharpModule;
  try {
    sharpModule = (await import('sharp')).default as unknown as Sharp;
    log.info('sharp available — generating WebP derivatives');
  } catch {
    sharpModule = null;
    log.warn('sharp unavailable — serving original images without derivatives');
  }
  return sharpModule;
}

interface Derivatives {
  full: Buffer;
  thumb: Buffer;
  ext: string;
  width?: number;
  height?: number;
  exif?: StoredPhoto['exif'];
}

async function derive(buffer: Buffer, mime: string): Promise<Derivatives> {
  const sharp = await getSharp();
  if (!sharp) {
    return { full: buffer, thumb: buffer, ext: ALLOWED.get(mime) ?? 'jpg' };
  }

  const image = sharp(buffer, { failOn: 'none' });
  const meta = await image.metadata();

  const [full, thumb] = await Promise.all([
    sharp(buffer, { failOn: 'none' }).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
    sharp(buffer, { failOn: 'none' }).rotate().resize({ width: 420, height: 320, fit: 'cover' }).webp({ quality: 74 }).toBuffer(),
  ]);

  // EXIF is extracted, kept for the integrity checks, and then dropped from
  // everything served publicly — the .webp re-encode above strips it already.
  const exif = readExif(meta as { exif?: Buffer });

  return { full, thumb, ext: 'webp', width: meta.width, height: meta.height, exif };
}

function readExif(meta: { exif?: Buffer }): StoredPhoto['exif'] | undefined {
  if (!meta.exif) return undefined;
  // A full EXIF parser is a phase 09 concern; what the integrity checks need
  // is capture time and GPS, and sharp surfaces the raw block for that.
  const raw = meta.exif.toString('latin1');
  const dateMatch = raw.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  const capturedAt = dateMatch
    ? new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T${dateMatch[4]}:${dateMatch[5]}:${dateMatch[6]}`)
    : undefined;
  return capturedAt && !Number.isNaN(capturedAt.valueOf()) ? { capturedAt } : undefined;
}

// --- Local driver -----------------------------------------------------------

const UPLOAD_ROOT = path.resolve(process.cwd(), 'var', 'uploads');

class LocalStorage implements StorageAdapter {
  readonly driver = 'local' as const;

  async put(file: { buffer: Buffer; mimetype: string }): Promise<StoredPhoto> {
    const mime = validateUpload(file);
    const { full, thumb, ext, width, height, exif } = await derive(file.buffer, mime);

    const id = crypto.randomUUID();
    const now = new Date();
    const dir = path.join(String(now.getUTCFullYear()), String(now.getUTCMonth() + 1).padStart(2, '0'));
    const key = `${dir}/${id}.${ext}`;
    const thumbKey = `${dir}/${id}_t.${ext}`;

    await fs.mkdir(path.join(UPLOAD_ROOT, dir), { recursive: true });
    await Promise.all([
      fs.writeFile(path.join(UPLOAD_ROOT, key), full),
      fs.writeFile(path.join(UPLOAD_ROOT, thumbKey), thumb),
    ]);

    return {
      id,
      key,
      url: `${env.API_PUBLIC_URL}/uploads/${key}`,
      thumbUrl: `${env.API_PUBLIC_URL}/uploads/${thumbKey}`,
      width,
      height,
      bytes: full.length,
      exif,
    };
  }

  async remove(key: string): Promise<void> {
    const ext = path.extname(key);
    const thumbKey = key.replace(new RegExp(`${ext}$`), `_t${ext}`);
    await Promise.allSettled([
      fs.unlink(path.join(UPLOAD_ROOT, key)),
      fs.unlink(path.join(UPLOAD_ROOT, thumbKey)),
    ]);
  }
}

// --- S3 driver (phase 14) ---------------------------------------------------

/**
 * Deliberately not implemented yet rather than faked: it needs
 * @aws-sdk/client-s3 plus presigned PUT URLs so image bytes never pass through
 * this process. The interface above is what phase 14 fills in, and the local
 * driver already produces the same StoredPhoto shape.
 */
class S3Storage implements StorageAdapter {
  readonly driver = 's3' as const;
  async put(): Promise<StoredPhoto> {
    throw new HttpError(
      501,
      'not_implemented',
      'The S3 driver is a phase 14 task. Set STORAGE_DRIVER=local for now.',
    );
  }
  async remove(): Promise<void> {
    throw new HttpError(501, 'not_implemented', 'The S3 driver is a phase 14 task.');
  }
}

export const storage: StorageAdapter = env.STORAGE_DRIVER === 's3' ? new S3Storage() : new LocalStorage();
export const uploadRoot = UPLOAD_ROOT;
