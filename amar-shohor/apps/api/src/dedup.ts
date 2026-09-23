import { CATEGORY_META, computePriority, distanceMeters, type Category, type GeoPoint } from '@amar/shared';
import { cosine, meanVector } from './ai';
import { env } from './env';
import { makeRef } from './http';
import { log } from './log';
import { Issue, Report, StatusEvent, Ward, type IssueDoc, type ReportDoc } from './models';

/**
 * Phase 10 — deduplication.
 *
 * "Many reports, one verified problem" is the product's central claim, so the
 * decision is scored rather than guessed, and the score is stored on the
 * report. Three outcomes:
 *
 *   >= DEDUP_AUTO_MERGE   attach to the existing issue
 *   >= DEDUP_REVIEW       hold for the moderator console
 *   otherwise             open a new issue
 *
 * Every merge is reversible and audited, because a wrong merge hides a real
 * problem — the failure mode that costs the most trust.
 */

export interface MatchFactor {
  key: 'distance' | 'category' | 'time' | 'image' | 'text';
  weight: number;
  value: number;
  detail: string;
}

export interface MatchScore {
  issueId: string;
  score: number;
  factors: MatchFactor[];
}

/** Weights sum to 1. Image similarity carries the most because GPS drifts. */
const WEIGHTS = { distance: 0.3, category: 0.2, time: 0.12, image: 0.3, text: 0.08 } as const;

type ReportLike = Pick<ReportDoc, 'category' | 'location' | 'description' | 'createdAt'> & {
  ai?: { embedding?: number[] | null } | null;
};

export function scoreMatch(report: ReportLike, issue: IssueDoc & { _id: unknown }): MatchScore {
  const dist = distanceMeters(report.location as GeoPoint, issue.location as GeoPoint);

  // Linear falloff over the configured radius: same spot 1.0, edge 0.0.
  const distanceValue = Math.max(0, 1 - dist / env.DEDUP_RADIUS_M);

  // Same category is the strong signal; same department is a weak one, since
  // "pothole" and "sidewalk damage" are often the same physical defect.
  const sameCategory = report.category === issue.category;
  const sameDept = CATEGORY_META[report.category as Category].department === CATEGORY_META[issue.category as Category].department;
  const categoryValue = sameCategory ? 1 : sameDept ? 0.45 : 0;

  const ageDays = Math.abs(
    ((report.createdAt as Date | undefined)?.valueOf() ?? Date.now()) - new Date(issue.firstReportAt).valueOf(),
  ) / 86_400_000;
  const timeValue = Math.max(0, 1 - ageDays / env.DEDUP_WINDOW_DAYS);

  const reportEmbedding = report.ai?.embedding ?? [];
  const issueEmbedding = issue.embedding ?? [];
  const hasVectors = reportEmbedding.length > 0 && issueEmbedding.length > 0;
  // Cosine sits in [-1,1]; rescale to [0,1] so it cannot subtract from the sum.
  const imageValue = hasVectors ? Math.max(0, cosine(reportEmbedding, issueEmbedding)) : 0;

  const textValue = jaccard(report.description ?? '', issue.description ?? '');

  const factors: MatchFactor[] = [
    { key: 'distance', weight: WEIGHTS.distance, value: distanceValue, detail: `${Math.round(dist)} m apart` },
    {
      key: 'category',
      weight: WEIGHTS.category,
      value: categoryValue,
      detail: sameCategory ? 'Same category' : sameDept ? 'Related category, same department' : 'Different category',
    },
    { key: 'time', weight: WEIGHTS.time, value: timeValue, detail: `${Math.round(ageDays)} days apart` },
    {
      key: 'image',
      weight: WEIGHTS.image,
      value: imageValue,
      // Being explicit beats silently scoring 0 — this is the line that tells a
      // reviewer the AI service was down when the decision was made.
      detail: hasVectors ? `Photo similarity ${(imageValue * 100).toFixed(0)}%` : 'No photo embedding available',
    },
    { key: 'text', weight: WEIGHTS.text, value: textValue, detail: textValue > 0 ? 'Descriptions overlap' : 'No description overlap' },
  ];

  // Renormalise over the factors that actually had data, so a missing
  // embedding does not silently cap every score at 0.7.
  const usable = factors.filter((f) => !(f.key === 'image' && !hasVectors));
  const totalWeight = usable.reduce((s, f) => s + f.weight, 0);
  const score = usable.reduce((s, f) => s + f.value * f.weight, 0) / (totalWeight || 1);

  return { issueId: String(issue._id), score, factors };
}

/** Word-level Jaccard. Crude, and only ever 8% of the score. */
function jaccard(a: string, b: string): number {
  const norm = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((w) => w.length > 2),
    );
  const setA = norm(a);
  const setB = norm(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let shared = 0;
  for (const w of setA) if (setB.has(w)) shared += 1;
  return shared / (setA.size + setB.size - shared);
}

export interface DedupOutcome {
  decision: 'auto' | 'pending' | 'new';
  issueId: string;
  confidence: number;
  factors?: MatchFactor[];
}

/**
 * Candidate generation, then scoring. The $near query does the cheap
 * geospatial narrowing so we only ever score a handful of issues.
 */
export async function resolveReport(report: ReportDoc & { _id: unknown }): Promise<DedupOutcome> {
  const since = new Date(Date.now() - env.DEDUP_WINDOW_DAYS * 86_400_000);

  const candidates = await Issue.find({
    status: { $nin: ['resolved', 'rejected'] },
    firstReportAt: { $gte: since },
    location: {
      $near: {
        $geometry: report.location,
        $maxDistance: env.DEDUP_RADIUS_M,
      },
    },
  })
    .limit(25)
    .lean<(IssueDoc & { _id: unknown })[]>();

  const scored = candidates
    .map((issue) => scoreMatch(report, issue))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];

  if (best && best.score >= env.DEDUP_AUTO_MERGE) {
    await attachReport(best.issueId, report, 'auto', best.score);
    log.info('report auto-merged', { report: report.ref, issue: best.issueId, score: best.score.toFixed(3) });
    return { decision: 'auto', issueId: best.issueId, confidence: best.score, factors: best.factors };
  }

  if (best && best.score >= env.DEDUP_REVIEW) {
    // Held deliberately: the report stays visible to its reporter and to the
    // moderator console, but does not inflate the issue's report count until
    // a human agrees. A wrong auto-merge is worse than a slow one.
    await Report.updateOne(
      { _id: report._id },
      { $set: { mergeDecision: 'pending', mergeConfidence: best.score, issueId: null } },
    );
    log.info('report held for review', { report: report.ref, issue: best.issueId, score: best.score.toFixed(3) });
    return { decision: 'pending', issueId: best.issueId, confidence: best.score, factors: best.factors };
  }

  const issue = await createIssueFromReport(report);
  return { decision: 'new', issueId: String(issue._id), confidence: best?.score ?? 0 };
}

export async function createIssueFromReport(report: ReportDoc & { _id: unknown }) {
  const ward = report.wardId ? await Ward.findById(report.wardId).lean() : await nearestWard(report.location as GeoPoint);
  const meta = CATEGORY_META[report.category as Category];

  const priority = computePriority({
    category: report.category as Category,
    severity: report.severity ?? 3,
    reportCount: 1,
    wardDensity: ward?.densityPerKm2 ?? 20_000,
    ageHours: 0,
  });

  const issue = await Issue.create({
    ref: makeRef('AS'),
    title: meta.en,
    category: report.category,
    status: 'reported',
    severity: report.severity ?? 3,
    description: report.description,
    location: report.location,
    address: report.address,
    wardId: ward?._id,
    reportIds: [report._id],
    reportCount: 1,
    photos: report.photos,
    embedding: report.ai?.embedding ?? undefined,
    department: meta.department,
    priorityScore: priority.score,
    priorityBand: priority.band,
    priorityFactors: priority.factors,
    firstReportAt: report.createdAt ?? new Date(),
  });

  await Report.updateOne(
    { _id: report._id },
    { $set: { issueId: issue._id, mergeDecision: 'new', wardId: ward?._id } },
  );

  await StatusEvent.create({
    issueId: issue._id,
    status: 'reported',
    note: 'Reported by a citizen',
    actorId: report.reporterId,
    actorRole: 'citizen',
    at: report.createdAt ?? new Date(),
  });

  return issue;
}

/** Attaches a report to an issue and recomputes everything that depends on it. */
export async function attachReport(
  issueId: string,
  report: ReportDoc & { _id: unknown },
  decision: 'auto' | 'reviewed',
  confidence: number,
) {
  const issue = await Issue.findById(issueId);
  if (!issue) throw new Error(`issue ${issueId} vanished during merge`);

  const alreadyIn = (issue.reportIds ?? []).some((id) => String(id) === String(report._id));
  if (!alreadyIn) {
    issue.reportIds = [...(issue.reportIds ?? []), report._id] as typeof issue.reportIds;
    issue.reportCount = (issue.reportIds ?? []).length;
  }

  // The issue keeps the worst severity reported, not the average — a pothole
  // one person called dangerous is dangerous.
  issue.severity = Math.max(issue.severity ?? 3, report.severity ?? 3);

  // Centroid of the merged reports, so the pin converges on the real spot.
  const members = await Report.find({ _id: { $in: issue.reportIds } }).select('location ai.embedding').lean();
  const pts = members.map((r) => (r.location as GeoPoint).coordinates);
  if (pts.length > 0) {
    const lng = pts.reduce((s, p) => s + (p[0] ?? 0), 0) / pts.length;
    const lat = pts.reduce((s, p) => s + (p[1] ?? 0), 0) / pts.length;
    issue.location = { type: 'Point', coordinates: [lng, lat] } as typeof issue.location;
  }

  const vectors = members.map((r) => r.ai?.embedding ?? []).filter((v): v is number[] => Array.isArray(v) && v.length > 0);
  const mean = meanVector(vectors);
  if (mean) issue.embedding = mean as typeof issue.embedding;

  // Photos from every contributing report, capped — the merge proof card shows
  // the first few and the detail page lists the rest per report.
  const merged = [...(issue.photos ?? []), ...(report.photos ?? [])];
  issue.photos = merged.slice(0, 8) as typeof issue.photos;

  await issue.save();
  await recomputePriority(String(issue._id));

  await Report.updateOne(
    { _id: report._id },
    { $set: { issueId: issue._id, mergeDecision: decision, mergeConfidence: confidence, wardId: issue.wardId } },
  );

  return issue;
}

/** Recomputes the stored score. Called on merge, on status change, and nightly. */
export async function recomputePriority(issueId: string) {
  const issue = await Issue.findById(issueId);
  if (!issue) return null;

  const ward = issue.wardId ? await Ward.findById(issue.wardId).lean() : null;
  const ageHours = (Date.now() - new Date(issue.firstReportAt).valueOf()) / 3_600_000;

  const priority = computePriority({
    category: issue.category as Category,
    severity: issue.severity ?? 3,
    reportCount: issue.reportCount ?? 1,
    wardDensity: ward?.densityPerKm2 ?? 20_000,
    // A resolved issue should stop climbing the queue as it ages.
    ageHours: issue.resolvedAt ? 0 : ageHours,
  });

  issue.priorityScore = priority.score;
  issue.priorityBand = priority.band;
  issue.priorityFactors = priority.factors as typeof issue.priorityFactors;
  await issue.save();
  return priority;
}

export async function nearestWard(at: GeoPoint) {
  // Point-in-polygon first, since a report is normally inside a ward; the
  // $near fallback covers gaps in the boundary data.
  const containing = await Ward.findOne({ boundary: { $geoIntersects: { $geometry: at } } }).lean();
  if (containing) return containing;
  return Ward.findOne({ center: { $near: { $geometry: at } } }).lean();
}
