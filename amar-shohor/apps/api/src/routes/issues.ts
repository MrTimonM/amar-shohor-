import { Router } from 'express';
import {
  CATEGORIES,
  STATUSES,
  distanceMeters,
  issueQuerySchema,
  verifySchema,
  type GeoPoint,
  type IssueSummary,
} from '@amar/shared';
import { requireUser } from '../auth';
import { recomputePriority } from '../dedup';
import { env } from '../env';
import { HttpError, parse, route } from '../http';
import { log } from '../log';
import {
  Issue,
  Report,
  StatusEvent,
  User,
  Verification,
  Ward,
  type IssueDoc,
  type ReportDoc,
  type StatusEventDoc,
  type UserDoc,
  type WardDoc,
} from '../models';
import { issueDetail, issueSummary } from '../serialize';

export const issuesRouter = Router();

/**
 * Phase 07 — the map query.
 *
 * Bounded by the viewport, never by the city: at Dhaka scale an unbounded
 * query would ship tens of thousands of documents to a phone. Reading is
 * anonymous throughout.
 */
issuesRouter.get(
  '/',
  route(async (req, res) => {
    const q = parse(issueQuerySchema, req.query);
    const filter: Record<string, unknown> = {};

    if (q.bbox) {
      const [west, south, east, north] = q.bbox.split(',').map(Number) as [number, number, number, number];
      filter.location = {
        $geoWithin: {
          $box: [
            [west, south],
            [east, north],
          ],
        },
      };
    }

    if (q.category) {
      const wanted = q.category.split(',').filter((c) => (CATEGORIES as readonly string[]).includes(c));
      if (wanted.length > 0) filter.category = { $in: wanted };
    }
    if (q.status) {
      const wanted = q.status.split(',').filter((s) => (STATUSES as readonly string[]).includes(s));
      if (wanted.length > 0) filter.status = { $in: wanted };
    } else {
      // The default map view is what still needs doing.
      filter.status = { $nin: ['rejected'] };
    }
    if (q.ward) filter.wardId = q.ward;
    if (q.band) filter.priorityBand = q.band;
    if (q.since) filter.createdAt = { $gte: q.since };
    if (q.q) filter.$or = [{ ref: q.q.toUpperCase() }, { title: { $regex: escapeRegex(q.q), $options: 'i' } }];

    // Explicitly typed: mongoose's sort() rejects an object whose keys can be
    // undefined, which is what a ternary over differing shapes produces.
    const SORTS: Record<string, Record<string, 1 | -1>> = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      reports: { reportCount: -1 },
      priority: { priorityScore: -1 },
    };
    const sort = SORTS[q.sort] ?? SORTS.priority!;

    const [items, total] = await Promise.all([
      Issue.find(filter).sort(sort).limit(q.limit).lean<(IssueDoc & { _id: unknown })[]>(),
      Issue.countDocuments(filter),
    ]);

    const wards = await wardMap(items);
    res.json({
      items: items.map((i) => issueSummary(i, { ward: wards.get(String(i.wardId)) })),
      total,
    });
  }),
);

issuesRouter.get(
  '/:id',
  route(async (req, res) => {
    const issue = await findIssue(req.params.id);

    const [reports, timeline, ward, assignee] = await Promise.all([
      Report.find({ issueId: issue._id }).sort({ createdAt: 1 }).lean<(ReportDoc & { _id: unknown })[]>(),
      StatusEvent.find({ issueId: issue._id }).sort({ at: 1 }).lean<(StatusEventDoc & { _id: unknown })[]>(),
      issue.wardId ? Ward.findById(issue.wardId).lean<WardDoc & { _id: unknown }>() : null,
      issue.assigneeId ? User.findById(issue.assigneeId).lean<UserDoc & { _id: unknown }>() : null,
    ]);

    const reporters = await User.find({ _id: { $in: reports.map((r) => r.reporterId).filter(Boolean) } }).lean<
      (UserDoc & { _id: unknown })[]
    >();
    const byId = new Map(reporters.map((u) => [String(u._id), u]));

    // Same category, nearby, still open — the "is this actually the same
    // problem?" check a reader wants without leaving the page.
    const nearbyDocs = await Issue.find({
      _id: { $ne: issue._id },
      status: { $nin: ['resolved', 'rejected'] },
      location: { $near: { $geometry: issue.location as GeoPoint, $maxDistance: 900 } },
    })
      .limit(4)
      .lean<(IssueDoc & { _id: unknown })[]>();

    const myVote = req.user
      ? (await Verification.findOne({ issueId: issue._id, userId: req.user.id }).lean())?.vote
      : undefined;

    const viewerAt = parseAt(req.query.at);

    res.json(
      issueDetail(issue, {
        reports: reports.map((report) => ({ report, reporter: byId.get(String(report.reporterId)) })),
        timeline,
        nearby: nearbyDocs.map((n) => issueSummary(n)),
        ward,
        assignee,
        myVote: myVote as 'confirm' | 'dispute' | undefined,
        viewerAt,
      }),
    );
  }),
);

/**
 * Phase 12 — community verification.
 *
 * Two gates make "verified by the community" mean something: only a device
 * that has actually been near the location may vote, and votes are weighted by
 * the voter's trust so a fresh account cannot carry an issue alone.
 */
issuesRouter.post(
  '/:id/verify',
  route(async (req, res) => {
    const auth = requireUser(req);
    const input = parse(verifySchema, req.body);
    const issue = await findIssue(req.params.id);

    const distance = distanceMeters(input.at, issue.location as GeoPoint);
    if (distance > env.VERIFY_PROXIMITY_M) {
      throw HttpError.forbidden(
        `You need to be within ${env.VERIFY_PROXIMITY_M} m of the problem to verify it. You are ${Math.round(distance)} m away.`,
      );
    }

    const reportedByMe = await Report.exists({ issueId: issue._id, reporterId: auth.id });
    if (reportedByMe) throw HttpError.conflict('You reported this one, so your confirmation is already counted.');

    const existing = await Verification.findOne({ issueId: issue._id, userId: auth.id });
    if (existing) throw HttpError.conflict('You have already voted on this problem.');

    const user = await User.findById(auth.id);
    const weight = Math.max(0.25, Math.min(user?.trust ?? 1, 5));

    await Verification.create({
      issueId: issue._id,
      userId: auth.id,
      vote: input.vote,
      weight,
      distanceM: Math.round(distance),
      note: input.note,
    });

    const inc =
      input.vote === 'confirm'
        ? { confirms: 1, weightedConfirms: weight }
        : { disputes: 1, weightedDisputes: weight };
    await Issue.updateOne({ _id: issue._id }, { $inc: inc });
    await User.updateOne({ _id: auth.id }, { $inc: { verifiedCount: 1 } });

    const updated = await Issue.findById(issue._id);
    if (!updated) throw HttpError.notFound();

    // The threshold is published in the API response, so a citizen can see
    // exactly how far an issue is from being verified.
    const crossed =
      updated.status === 'reported' &&
      (updated.weightedConfirms ?? 0) >= env.VERIFY_THRESHOLD &&
      (updated.weightedConfirms ?? 0) > (updated.weightedDisputes ?? 0) * 2;

    if (crossed) {
      updated.status = 'verified';
      updated.verifiedAt = new Date();
      await updated.save();
      await StatusEvent.create({
        issueId: updated._id,
        status: 'verified',
        from: 'reported',
        note: `Confirmed by ${updated.confirms} nearby ${updated.confirms === 1 ? 'citizen' : 'citizens'}`,
        actorName: 'Community',
        actorRole: 'verifier',
      });
      // Confirming real problems is what raises trust (phase 04).
      await User.updateMany(
        { _id: { $in: await confirmerIds(String(updated._id)) } },
        { $inc: { trust: 0.05 } },
      );
      log.info('issue verified by community', { issue: updated.ref, confirms: updated.confirms });
    }

    await recomputePriority(String(updated._id));
    const fresh = await Issue.findById(updated._id).lean<IssueDoc & { _id: unknown }>();
    res.json({
      verification: fresh ? issueSummary(fresh, { myVote: input.vote, viewerAt: input.at }).verification : undefined,
      statusChanged: crossed,
    });
  }),
);

// --- helpers ----------------------------------------------------------------

async function findIssue(idOrRef?: string) {
  if (!idOrRef) throw HttpError.badRequest('An issue id is required');
  const byId = /^[a-f\d]{24}$/i.test(idOrRef)
    ? await Issue.findById(idOrRef).lean<IssueDoc & { _id: unknown }>()
    : null;
  const issue = byId ?? (await Issue.findOne({ ref: idOrRef.toUpperCase() }).lean<IssueDoc & { _id: unknown }>());
  if (!issue) throw HttpError.notFound('That problem does not exist, or the reference is wrong.');
  return issue;
}

async function wardMap(items: (IssueDoc & { _id: unknown })[]) {
  const ids = [...new Set(items.map((i) => i.wardId).filter(Boolean).map(String))];
  const wards = await Ward.find({ _id: { $in: ids } }).lean<(WardDoc & { _id: unknown })[]>();
  return new Map(wards.map((w) => [String(w._id), w]));
}

const confirmerIds = async (issueId: string) =>
  (await Verification.find({ issueId, vote: 'confirm' }).select('userId').lean()).map((v) => v.userId);

function parseAt(raw: unknown): GeoPoint | undefined {
  if (typeof raw !== 'string') return undefined;
  const [lat, lng] = raw.split(',').map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  return { type: 'Point', coordinates: [lng as number, lat as number] };
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export type { IssueSummary };
