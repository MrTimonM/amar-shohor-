import { Router } from 'express';
import {
  CATEGORY_META,
  createReportSchema,
  distanceMeters,
  type Category,
  type GeoPoint,
} from '@amar/shared';
import { analysePhoto, enqueue } from '../ai';
import { rateLimit, requireUser } from '../auth';
import { attachReport, nearestWard, recomputePriority, resolveReport } from '../dedup';
import { env } from '../env';
import { HttpError, makeRef, parse, route } from '../http';
import { log } from '../log';
import { Issue, Report, Upload, User, type IssueDoc, type ReportDoc, type UserDoc } from '../models';
import { issueSummary, reportSummary } from '../serialize';

export const reportsRouter = Router();

/**
 * Phase 05 + 08 + 10, in the order they run.
 *
 * The response returns as soon as the report is durable. Vision analysis and
 * deduplication happen in a background job, so a citizen on a bad connection
 * is never waiting on a model — which is the whole reason phase 08 made
 * inference asynchronous.
 */
reportsRouter.post(
  '/',
  rateLimit({ windowMs: 60_000, max: 10 }),
  route(async (req, res) => {
    const auth = requireUser(req);
    const input = parse(createReportSchema, req.body);

    // Photo ids are resolved server-side against this user's own uploads.
    const uploads = await Upload.find({
      'photo.id': { $in: input.photoIds },
      ownerId: auth.id,
      claimedAt: { $exists: false },
    });
    if (uploads.length !== input.photoIds.length) {
      throw HttpError.badRequest('Those photos have expired. Re-take the photo and submit again.');
    }

    const ward = await nearestWard(input.location);

    const report = await Report.create({
      ref: makeRef('RP'),
      category: input.category,
      severity: input.severity ?? 3,
      description: input.description,
      location: input.location,
      accuracy: input.accuracy,
      address: ward ? `${ward.name}, ${ward.cityCorporation}` : undefined,
      photos: uploads.map((u) => u.photo),
      reporterId: auth.id,
      wardId: ward?._id,
      queuedOffline: input.queuedOffline,
      capturedAt: input.capturedAt,
      mergeDecision: 'pending',
    });

    await Upload.updateMany({ _id: { $in: uploads.map((u) => u._id) } }, { $set: { claimedAt: new Date() } });
    await User.updateOne({ _id: auth.id }, { $inc: { reportCount: 1 } });

    // A citizen who tapped an existing issue instead of filing blind is a
    // confirmed duplicate — no scoring needed, and it is the cheapest and most
    // accurate dedup signal we get.
    if (input.confirmsIssueId) {
      const target = await Issue.findById(input.confirmsIssueId);
      if (target) {
        await attachReport(String(target._id), report.toObject() as ReportDoc & { _id: unknown }, 'reviewed', 1);
        enqueue(`enrich:${report.ref}`, () => enrich(String(report._id), false));
        const fresh = await Issue.findById(target._id).lean<IssueDoc & { _id: unknown }>();
        res.status(201).json({
          report: reportSummary(report.toObject() as ReportDoc & { _id: unknown }),
          issue: fresh ? issueSummary(fresh, { ward }) : undefined,
          dedup: { decision: 'auto', confidence: 1, reason: 'You confirmed an existing problem' },
        });
        return;
      }
    }

    enqueue(`enrich:${report.ref}`, () => enrich(String(report._id), true));

    res.status(201).json({
      report: reportSummary(report.toObject() as ReportDoc & { _id: unknown }),
      /** The client polls this report until dedup has run. */
      pending: true,
    });
  }),
);

/**
 * The background job: analyse the photo, then decide where the report belongs.
 * Runs whether or not the AI service is up — dedup falls back to geography,
 * category and time, and records that no embedding was available.
 */
async function enrich(reportId: string, runDedup: boolean): Promise<void> {
  const report = await Report.findById(reportId);
  if (!report) return;

  const firstPhoto = (report.photos ?? [])[0];
  if (firstPhoto) {
    const verdict = await analysePhoto({
      imageUrl: firstPhoto.url,
      reportedCategory: report.category as Category,
      description: report.description ?? undefined,
    });

    if (verdict) {
      const exif = firstPhoto.exif;
      const drift =
        exif?.lat != null && exif?.lng != null
          ? distanceMeters({ type: 'Point', coordinates: [exif.lng, exif.lat] }, report.location as GeoPoint)
          : undefined;

      report.ai = {
        model: verdict.model,
        category: verdict.category,
        categoryConfidence: verdict.categoryConfidence,
        severity: verdict.severity,
        relevant: verdict.relevant,
        embedding: verdict.embedding,
        integrity: {
          exifGpsDriftM: drift,
          captureToSubmitMinutes: exif?.capturedAt
            ? Math.round((new Date(report.createdAt ?? Date.now()).valueOf() - new Date(exif.capturedAt).valueOf()) / 60_000)
            : undefined,
          screenshotSuspected: verdict.integrity.screenshotSuspected,
          reusedImage: verdict.integrity.reusedImage,
        },
        // The citizen's own category always wins; the disagreement is the
        // training signal phase 09 collects.
        overriddenByUser: verdict.category !== report.category,
        at: new Date(),
      } as typeof report.ai;

      // Severity is the one field the model fills in when the citizen left it
      // at the default, since most people will not rate it themselves.
      if (report.severity === 3 && verdict.severity) report.severity = verdict.severity;

      if (verdict.relevant === false) {
        report.mergeDecision = 'pending';
        report.rejectedReason = 'The photo did not look like a street problem — held for review';
        await report.save();
        log.warn('report held: photo failed the relevance gate', { report: report.ref });
        return;
      }
      await report.save();
    }
  }

  if (!runDedup) return;

  const outcome = await resolveReport(report.toObject() as ReportDoc & { _id: unknown });
  if (outcome.decision === 'auto') await recomputePriority(outcome.issueId);
}

/** The citizen's own reports, newest first. */
reportsRouter.get(
  '/mine',
  route(async (req, res) => {
    const auth = requireUser(req);
    const reports = await Report.find({ reporterId: auth.id })
      .sort({ createdAt: -1 })
      .limit(60)
      .lean<(ReportDoc & { _id: unknown })[]>();

    const issueIds = reports.map((r) => r.issueId).filter(Boolean);
    const issues = await Issue.find({ _id: { $in: issueIds } }).lean<(IssueDoc & { _id: unknown })[]>();
    const byId = new Map(issues.map((i) => [String(i._id), i]));

    const user = await User.findById(auth.id).lean<UserDoc & { _id: unknown }>();

    res.json({
      items: reports.map((r) => ({
        ...reportSummary(r, user),
        issue: r.issueId ? (byId.get(String(r.issueId)) ? issueSummary(byId.get(String(r.issueId))!) : undefined) : undefined,
      })),
    });
  }),
);

/**
 * Phase 05 — the duplicate warning at the point of capture. Shown before the
 * citizen submits, so the cheapest deduplication is the one that never creates
 * a second report.
 */
reportsRouter.get(
  '/nearby',
  route(async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw HttpError.badRequest('lat and lng are required');
    }
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const radius = Math.min(Number(req.query.radius) || env.DEDUP_RADIUS_M, 1000);

    const query: Record<string, unknown> = {
      status: { $nin: ['resolved', 'rejected'] },
      location: { $near: { $geometry: { type: 'Point', coordinates: [lng, lat] }, $maxDistance: radius } },
    };
    if (category && category in CATEGORY_META) {
      const dept = CATEGORY_META[category as Category].department;
      const related = (Object.keys(CATEGORY_META) as Category[]).filter((c) => CATEGORY_META[c].department === dept);
      query.category = { $in: related };
    }

    const issues = await Issue.find(query).limit(6).lean<(IssueDoc & { _id: unknown })[]>();
    const here: GeoPoint = { type: 'Point', coordinates: [lng, lat] };

    res.json({
      items: issues.map((i) => ({
        ...issueSummary(i, { viewerAt: here }),
        distanceM: Math.round(distanceMeters(here, i.location as GeoPoint)),
      })),
    });
  }),
);
