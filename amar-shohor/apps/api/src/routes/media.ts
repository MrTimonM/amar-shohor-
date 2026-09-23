import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { CATEGORY_META, CATEGORIES, type Category } from '@amar/shared';
import { rateLimit, requireUser } from '../auth';
import { HttpError, route } from '../http';
import { Upload } from '../models';
import { MAX_UPLOAD_BYTES, storage } from '../storage';

export const mediaRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 4 },
});

/**
 * Phase 06. The local driver accepts the bytes here; the S3 driver will hand
 * back a presigned URL so the bytes never touch this process. Both return the
 * same photo shape, which is why the client does not care which is running.
 */
mediaRouter.post(
  '/photos',
  rateLimit({ windowMs: 60_000, max: 20 }),
  upload.array('photos', 4),
  route(async (req, res) => {
    const auth = requireUser(req);
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) throw HttpError.badRequest('Attach at least one photo');

    const stored = await Promise.all(files.map((f) => storage.put(f)));

    // Parked for 6 hours. The report submits ids; the server resolves them,
    // so a client cannot inject an arbitrary image URL onto the map.
    await Upload.insertMany(
      stored.map((p) => ({
        photo: p,
        ownerId: auth.id,
        expiresAt: new Date(Date.now() + 6 * 3600_000),
      })),
    );

    res.status(201).json({
      photos: stored.map((p) => ({ id: p.id, url: p.url, thumbUrl: p.thumbUrl, width: p.width, height: p.height })),
    });
  }),
);

/**
 * Deterministic placeholder art for seeded issues, so the demo runs offline
 * and nothing pretends to be a real photograph of a real street.
 */
mediaRouter.get('/placeholder/:category/:seed', (req, res) => {
  const category = (CATEGORIES as readonly string[]).includes(req.params.category)
    ? (req.params.category as Category)
    : 'road_damage';
  const seed = req.params.seed ?? '0';
  res.setHeader('content-type', 'image/svg+xml');
  res.setHeader('cache-control', 'public, max-age=31536000, immutable');
  res.send(placeholderSvg(category, seed));
});

const PALETTES: Record<Category, [string, string]> = {
  road_damage: ['#3b3f45', '#22262b'],
  waterlogging: ['#2f4a63', '#1b2b3a'],
  garbage: ['#4a4433', '#2b271d'],
  streetlight: ['#2c3348', '#1a1f2c'],
  traffic_signal: ['#4a2f33', '#2b1c1f'],
  sidewalk: ['#40423d', '#25261f'],
  congestion: ['#3d3646', '#231f29'],
  environmental: ['#2f4638', '#1b2921'],
};

function placeholderSvg(category: Category, seed: string): string {
  const [from, to] = PALETTES[category];
  const rng = mulberry(hash(`${category}:${seed}`));
  const label = CATEGORY_META[category].en;

  // A few coarse shapes suggesting a street scene, so thumbnails are
  // visually distinct in a grid without imitating photography.
  const shapes = Array.from({ length: 7 }, () => {
    const x = rng() * 420;
    const y = 150 + rng() * 150;
    const w = 30 + rng() * 120;
    const h = 8 + rng() * 40;
    const o = (0.05 + rng() * 0.16).toFixed(3);
    return `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" rx="3" fill="#ffffff" opacity="${o}"/>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="320" viewBox="0 0 420 320" role="img" aria-label="${label}">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
<rect width="420" height="320" fill="url(#g)"/>
<rect y="146" width="420" height="4" fill="#ffffff" opacity="0.10"/>
${shapes}
<text x="16" y="300" font-family="ui-monospace, monospace" font-size="11" fill="#ffffff" opacity="0.42">${label} · sample</text>
</svg>`;
}

const hash = (s: string) => {
  const digest = crypto.createHash('sha1').update(s).digest();
  return digest.readUInt32BE(0);
};

/** Small deterministic PRNG so a given seed always draws the same scene. */
function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
