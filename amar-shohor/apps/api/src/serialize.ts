import type {
  IssueDetail,
  IssueSummary,
  Me,
  Photo,
  ReportSummary,
  StatusEventView,
  VerificationSummary,
  WardSummary,
} from '@amar/shared';
import { bandFor, distanceMeters, type Category, type Department, type GeoPoint, type Role, type Status } from '@amar/shared';
import { env } from './env';
import type { IssueDoc, PhotoDoc, ReportDoc, StatusEventDoc, UserDoc, WardDoc } from './models';

/**
 * The boundary between stored documents and what goes over the wire. Two
 * things happen here that matter: Mongo's _id becomes a string id, and EXIF is
 * dropped — it is kept for the integrity checks and never served publicly.
 */

type WithId<T> = T & { _id: unknown };

const id = (doc: { _id: unknown }) => String(doc._id);

export const photo = (p: PhotoDoc): Photo => ({
  id: p.id,
  url: p.url,
  thumbUrl: p.thumbUrl,
  width: p.width ?? undefined,
  height: p.height ?? undefined,
});

export const ward = (w: WithId<WardDoc> | null | undefined): WardSummary | undefined =>
  w
    ? {
        id: id(w),
        name: w.name,
        nameBn: w.nameBn,
        cityCorporation: w.cityCorporation,
        densityPerKm2: w.densityPerKm2,
      }
    : undefined;

export const reportSummary = (r: WithId<ReportDoc>, reporter?: WithId<UserDoc> | null): ReportSummary => ({
  id: id(r),
  ref: r.ref,
  category: r.category as Category,
  severity: r.severity ?? 3,
  description: r.description ?? undefined,
  location: r.location as GeoPoint,
  photos: (r.photos ?? []).map(photo),
  createdAt: new Date(r.createdAt ?? Date.now()).toISOString(),
  queuedOffline: r.queuedOffline ?? undefined,
  reporter: reporter ? { id: id(reporter), name: reporter.name, trust: reporter.trust ?? 1 } : undefined,
  ai: r.ai
    ? {
        model: r.ai.model ?? 'unknown',
        category: (r.ai.category as Category) ?? undefined,
        categoryConfidence: r.ai.categoryConfidence ?? undefined,
        severity: r.ai.severity ?? undefined,
        relevant: r.ai.relevant ?? undefined,
        integrity: r.ai.integrity
          ? {
              exifGpsDriftM: r.ai.integrity.exifGpsDriftM ?? undefined,
              captureToSubmitMinutes: r.ai.integrity.captureToSubmitMinutes ?? undefined,
              screenshotSuspected: r.ai.integrity.screenshotSuspected ?? undefined,
              reusedImage: r.ai.integrity.reusedImage ?? undefined,
            }
          : undefined,
        overriddenByUser: r.ai.overriddenByUser ?? undefined,
        at: new Date(r.ai.at ?? Date.now()).toISOString(),
      }
    : undefined,
  issueId: r.issueId ? String(r.issueId) : undefined,
  mergeConfidence: r.mergeConfidence ?? undefined,
  mergeDecision: (r.mergeDecision as ReportSummary['mergeDecision']) ?? undefined,
});

export function verification(
  issue: WithId<IssueDoc>,
  opts: { myVote?: 'confirm' | 'dispute'; viewerAt?: GeoPoint } = {},
): VerificationSummary {
  const distanceM = opts.viewerAt ? distanceMeters(opts.viewerAt, issue.location as GeoPoint) : undefined;
  return {
    confirms: issue.confirms ?? 0,
    disputes: issue.disputes ?? 0,
    weightedConfirms: Number((issue.weightedConfirms ?? 0).toFixed(2)),
    weightedDisputes: Number((issue.weightedDisputes ?? 0).toFixed(2)),
    threshold: env.VERIFY_THRESHOLD,
    myVote: opts.myVote,
    eligible: distanceM === undefined ? undefined : distanceM <= env.VERIFY_PROXIMITY_M,
    distanceM: distanceM === undefined ? undefined : Math.round(distanceM),
  };
}

export function issueSummary(
  i: WithId<IssueDoc>,
  extra: {
    ward?: WithId<WardDoc> | null;
    assignee?: WithId<UserDoc> | null;
    myVote?: 'confirm' | 'dispute';
    viewerAt?: GeoPoint;
  } = {},
): IssueSummary {
  const score = i.priorityScore ?? 0;
  return {
    id: id(i),
    ref: i.ref,
    title: i.title,
    category: i.category as Category,
    status: i.status as Status,
    severity: i.severity ?? 3,
    location: i.location as GeoPoint,
    address: i.address ?? undefined,
    ward: ward(extra.ward),
    reportCount: i.reportCount ?? 1,
    photos: (i.photos ?? []).map(photo),
    priority: {
      score,
      band: (i.priorityBand as ReturnType<typeof bandFor>) ?? bandFor(score),
      factors: (i.priorityFactors ?? []).map((f) => ({
        key: f.key as 'severity',
        label: f.label ?? '',
        value: f.value ?? 0,
        weight: f.weight ?? 0,
        points: f.points ?? 0,
        detail: f.detail ?? '',
      })),
    },
    createdAt: new Date(i.createdAt ?? Date.now()).toISOString(),
    updatedAt: new Date(i.updatedAt ?? Date.now()).toISOString(),
    slaDueAt: i.slaDueAt ? new Date(i.slaDueAt).toISOString() : undefined,
    slaBreached: i.slaDueAt ? new Date(i.slaDueAt).valueOf() < Date.now() && !i.resolvedAt : false,
    verification: verification(i, { myVote: extra.myVote, viewerAt: extra.viewerAt }),
    assignee: extra.assignee
      ? {
          id: id(extra.assignee),
          name: extra.assignee.name,
          department: (extra.assignee.department ?? 'roads') as Department,
        }
      : undefined,
  };
}

export const statusEvent = (e: WithId<StatusEventDoc>): StatusEventView => ({
  id: id(e),
  status: e.status as Status,
  note: e.note ?? undefined,
  actor: { name: e.actorName ?? 'System', role: (e.actorRole as Role) ?? 'admin' },
  proofPhotos: (e.proofPhotos ?? []).map(photo),
  at: new Date(e.at ?? Date.now()).toISOString(),
});

export function issueDetail(
  i: WithId<IssueDoc>,
  parts: {
    reports: { report: WithId<ReportDoc>; reporter?: WithId<UserDoc> | null }[];
    timeline: WithId<StatusEventDoc>[];
    nearby: IssueSummary[];
    ward?: WithId<WardDoc> | null;
    assignee?: WithId<UserDoc> | null;
    myVote?: 'confirm' | 'dispute';
    viewerAt?: GeoPoint;
  },
): IssueDetail {
  return {
    ...issueSummary(i, parts),
    description: i.description ?? undefined,
    reports: parts.reports.map(({ report, reporter }) => reportSummary(report, reporter)),
    timeline: parts.timeline.map(statusEvent),
    proofPhotos: (i.proofPhotos ?? []).map(photo),
    nearby: parts.nearby,
  };
}

export const me = (u: WithId<UserDoc>): Me => ({
  id: id(u),
  name: u.name,
  phone: u.phone ?? undefined,
  email: u.email ?? undefined,
  role: u.role as Role,
  trust: u.trust ?? 1,
  department: (u.department as Me['department']) ?? undefined,
  wardIds: (u.wardIds ?? []).map(String),
  reportCount: u.reportCount ?? 0,
  verifiedCount: u.verifiedCount ?? 0,
});
