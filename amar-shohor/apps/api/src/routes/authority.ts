import { Router } from 'express';
import {
  CATEGORY_META,
  canTransition,
  mergeDecisionSchema,
  statusChangeSchema,
  type Category,
  type Status,
} from '@amar/shared';
import { requireRole, requireUser } from '../auth';
import { attachReport, createIssueFromReport, recomputePriority, scoreMatch } from '../dedup';
import { HttpError, parse, route } from '../http';
import { log } from '../log';
import {
  Issue,
  Report,
  StatusEvent,
  Upload,
  User,
  Ward,
  type IssueDoc,
  type ReportDoc,
  type UserDoc,
  type WardDoc,
} from '../models';
import { issueSummary, reportSummary } from '../serialize';

export const authorityRouter = Router();

/**
 * Phase 13 — the authority workspace.
 *
 * The triage queue is scoped to the department and wards the account actually
 * owns, sorted by the phase 10 priority score, with the SLA clock visible.
 */
authorityRouter.get(
  '/queue',
  requireRole('authority', 'admin'),
  route(async (req, res) => {
    const auth = requireUser(req);

    const filter: Record<string, unknown> = { status: { $nin: ['resolved', 'rejected'] } };
    // An admin sees everything; an authority account sees its own department.
    if (auth.role === 'authority' && auth.department) filter.department = auth.department;
    if (auth.role === 'authority' && auth.wardIds.length > 0) filter.wardId = { $in: auth.wardIds };

    if (req.query.status === 'mine') filter.assigneeId = auth.id;
    if (req.query.status === 'unassigned') filter.assigneeId = { $exists: false };
    if (req.query.status === 'overdue') {
      filter.slaDueAt = { $lt: new Date() };
      filter.resolvedAt = { $exists: false };
    }

    const issues = await Issue.find(filter)
      .sort({ priorityScore: -1, firstReportAt: 1 })
      .limit(200)
      .lean<(IssueDoc & { _id: unknown })[]>();

    const [wards, assignees] = await Promise.all([
      Ward.find({ _id: { $in: issues.map((i) => i.wardId).filter(Boolean) } }).lean<(WardDoc & { _id: unknown })[]>(),
      User.find({ _id: { $in: issues.map((i) => i.assigneeId).filter(Boolean) } }).lean<(UserDoc & { _id: unknown })[]>(),
    ]);
    const wardById = new Map(wards.map((w) => [String(w._id), w]));
    const userById = new Map(assignees.map((u) => [String(u._id), u]));

    res.json({
      items: issues.map((i) =>
        issueSummary(i, {
          ward: wardById.get(String(i.wardId)),
          assignee: userById.get(String(i.assigneeId)),
        }),
      ),
      counts: {
        total: issues.length,
        unassigned: issues.filter((i) => !i.assigneeId).length,
        overdue: issues.filter((i) => i.slaDueAt && new Date(i.slaDueAt) < new Date()).length,
      },
    });
  }),
);

/**
 * Who is allowed to move *this* issue.
 *
 * `requireRole('authority')` only says someone is staff somewhere in the city.
 * It does not say the waste department may close a pothole, and letting it
 * would make the department column on the public record meaningless — an
 * accountability tool that cannot say which department closed something is
 * not one.
 *
 * So: an **admin** may act on anything, an authority staffer may act on their
 * **own department's** issues, and the **assignee** may always act on what was
 * handed to them even if it was assigned across departments.
 */
function assertOwns(
  auth: { id: string; role: string; department?: string; wardIds: string[] },
  issue: { department?: string; assigneeId?: unknown; category: string },
): void {
  if (auth.role === 'admin') return;

  if (String(issue.assigneeId ?? '') === auth.id) return;

  // Fall back to the category's owning department for any issue written before
  // `department` was stamped on the document.
  const owner = issue.department ?? CATEGORY_META[issue.category as Category]?.department;

  if (!auth.department) {
    throw HttpError.forbidden(
      'This account is not attached to a department yet, so it cannot change a problem. Ask an administrator to set one.',
    );
  }
  if (owner !== auth.department) {
    throw HttpError.forbidden(
      `This problem belongs to the ${owner} department. Only they, the person it is assigned to, or an administrator can change it.`,
    );
  }
}

/**
 * The one write that moves an issue through its lifecycle. Four rules are
 * enforced here rather than in the UI:
 *   - the actor must own the issue (department, assignment, or admin),
 *   - the transition must be legal (shared TRANSITIONS table),
 *   - every change carries a note,
 *   - a proof-of-fix photo on closure is accepted but not required.
 */
authorityRouter.post(
  '/issues/:id/status',
  requireRole('authority', 'admin'),
  route(async (req, res) => {
    const auth = requireUser(req);
    const input = parse(statusChangeSchema, req.body);

    const issue = await Issue.findById(req.params.id);
    if (!issue) throw HttpError.notFound('That problem does not exist');

    assertOwns(auth, issue as unknown as { department?: string; assigneeId?: unknown; category: string });

    const from = issue.status as Status;
    if (from === input.to) throw HttpError.conflict(`This is already ${from.replace('_', ' ')}`);
    if (!canTransition(from, input.to)) {
      throw HttpError.conflict(`A problem cannot go from ${from.replace('_', ' ')} to ${input.to.replace('_', ' ')}`);
    }

    let proofPhotos: ReportDoc['photos'] = [];
    // A proof-of-fix photo is optional. When one is sent it is still validated
    // and still has to belong to the person closing the problem — optional
    // means "may be omitted", not "accept anything".
    if (input.to === 'resolved' && input.proofPhotoIds && input.proofPhotoIds.length > 0) {
      const uploads = await Upload.find({ 'photo.id': { $in: input.proofPhotoIds }, ownerId: auth.id });
      if (uploads.length !== input.proofPhotoIds.length) {
        throw HttpError.badRequest('Those photos have expired. Upload the proof-of-fix photo again.');
      }
      proofPhotos = uploads.map((u) => u.photo) as ReportDoc['photos'];
      await Upload.updateMany({ _id: { $in: uploads.map((u) => u._id) } }, { $set: { claimedAt: new Date() } });
    }

    if (input.to === 'assigned') {
      const assigneeId = input.assigneeId ?? auth.id;
      const assignee = await User.findById(assigneeId);
      if (!assignee || !['authority', 'admin'].includes(assignee.role as string)) {
        throw HttpError.badRequest('Assign this to an authority account');
      }
      // Handing work to another department is an administrator's call. Without
      // this, a staffer could assign an issue out of their own department and
      // then no longer be able to act on it themselves.
      if (auth.role !== 'admin' && assignee.role === 'authority' && assignee.department !== issue.department) {
        throw HttpError.forbidden('Only an administrator can assign a problem to another department.');
      }
      issue.assigneeId = assignee._id as typeof issue.assigneeId;
      issue.assignedAt = new Date();
      // The SLA clock starts at assignment, from the category's own budget.
      const hours = CATEGORY_META[issue.category as Category].slaHours;
      issue.slaDueAt = new Date(Date.now() + hours * 3600_000);
    }

    if (input.to === 'resolved') {
      issue.resolvedAt = new Date();
      issue.proofPhotos = [...(issue.proofPhotos ?? []), ...proofPhotos] as typeof issue.proofPhotos;
    }
    // Reopening clears the resolution so it stops counting as fixed.
    if (from === 'resolved' && input.to === 'assigned') {
      issue.resolvedAt = undefined;
      issue.citizenSignedOffAt = undefined;
    }

    issue.status = input.to;
    await issue.save();

    await StatusEvent.create({
      issueId: issue._id,
      status: input.to,
      from,
      note: input.note,
      actorId: auth.id,
      actorName: auth.name,
      actorRole: auth.role,
      proofPhotos,
    });

    await recomputePriority(String(issue._id));
    log.info('issue status changed', { issue: issue.ref, from, to: input.to, by: auth.id });

    const fresh = await Issue.findById(issue._id).lean<IssueDoc & { _id: unknown }>();
    res.json({ issue: fresh ? issueSummary(fresh) : undefined });
  }),
);

/**
 * Phase 10 — the moderator console.
 *
 * Reports that scored between the review and auto-merge thresholds wait here.
 * Throughput on this queue decides whether the public map stays clean, so the
 * response carries the score breakdown that produced the hold.
 */
authorityRouter.get(
  '/review',
  requireRole('authority', 'admin'),
  route(async (_req, res) => {
    const pending = await Report.find({ mergeDecision: 'pending', issueId: { $in: [null, undefined] } })
      .sort({ createdAt: 1 })
      .limit(50)
      .lean<(ReportDoc & { _id: unknown })[]>();

    const items = await Promise.all(
      pending.map(async (report) => {
        const candidates = await Issue.find({
          status: { $nin: ['resolved', 'rejected'] },
          location: { $near: { $geometry: report.location, $maxDistance: 250 } },
        })
          .limit(4)
          .lean<(IssueDoc & { _id: unknown })[]>();

        const scored = candidates
          .map((issue) => ({ issue: issueSummary(issue), match: scoreMatch(report, issue) }))
          .sort((a, b) => b.match.score - a.match.score);

        return { report: reportSummary(report), candidates: scored, reason: report.rejectedReason ?? undefined };
      }),
    );

    res.json({ items, total: items.length });
  }),
);

authorityRouter.post(
  '/review',
  requireRole('authority', 'admin'),
  route(async (req, res) => {
    const auth = requireUser(req);
    const input = parse(mergeDecisionSchema, req.body);

    const report = await Report.findById(input.reportId);
    if (!report) throw HttpError.notFound('That report does not exist');
    if (report.issueId) throw HttpError.conflict('That report has already been filed');

    if (input.action === 'reject') {
      report.mergeDecision = 'reviewed';
      report.rejectedReason = input.note ?? 'Rejected in review';
      await report.save();
      log.info('report rejected in review', { report: report.ref, by: auth.id });
      res.json({ ok: true, action: 'reject' });
      return;
    }

    if (input.action === 'merge') {
      if (!input.targetIssueId) throw HttpError.badRequest('Pick the problem to merge into');
      const issue = await attachReport(
        input.targetIssueId,
        report.toObject() as ReportDoc & { _id: unknown },
        'reviewed',
        report.mergeConfidence ?? 0,
      );
      await StatusEvent.create({
        issueId: issue._id,
        status: issue.status as Status,
        from: issue.status as Status,
        note: `Report ${report.ref} merged in during review${input.note ? ` — ${input.note}` : ''}`,
        actorId: auth.id,
        actorName: auth.name,
        actorRole: auth.role,
      });
      res.json({ ok: true, action: 'merge', issueId: String(issue._id) });
      return;
    }

    // split: this is genuinely a different problem, so it gets its own issue.
    const issue = await createIssueFromReport(report.toObject() as ReportDoc & { _id: unknown });
    await Report.updateOne({ _id: report._id }, { $set: { mergeDecision: 'reviewed' } });
    res.json({ ok: true, action: 'split', issueId: String(issue._id) });
  }),
);

/**
 * Phase 13 — citizen sign-off. Only the reporter's own confirmation counts
 * toward the resolution statistics on the public dashboard.
 */
authorityRouter.post(
  '/issues/:id/signoff',
  route(async (req, res) => {
    const auth = requireUser(req);
    const issue = await Issue.findById(req.params.id);
    if (!issue) throw HttpError.notFound('That problem does not exist');
    if (issue.status !== 'resolved') throw HttpError.conflict('This has not been marked resolved yet');

    const mine = await Report.exists({ issueId: issue._id, reporterId: auth.id });
    if (!mine) throw HttpError.forbidden('Only someone who reported this can sign it off');

    const accept = req.body?.accept !== false;

    if (accept) {
      issue.citizenSignedOffAt = new Date();
      await issue.save();
      await StatusEvent.create({
        issueId: issue._id,
        status: 'resolved',
        from: 'resolved',
        note: 'The citizen who reported it confirmed the fix',
        actorId: auth.id,
        actorName: auth.name,
        actorRole: auth.role,
      });
      res.json({ ok: true, signedOff: true });
      return;
    }

    // Reopened: the fix did not hold, so it goes back to the assignee.
    issue.status = 'assigned';
    issue.resolvedAt = undefined;
    issue.citizenSignedOffAt = undefined;
    await issue.save();
    await StatusEvent.create({
      issueId: issue._id,
      status: 'assigned',
      from: 'resolved',
      note: req.body?.note ? `Reopened by the reporter — ${String(req.body.note).slice(0, 300)}` : 'Reopened by the reporter: the problem is still there',
      actorId: auth.id,
      actorName: auth.name,
      actorRole: auth.role,
    });
    await recomputePriority(String(issue._id));
    res.json({ ok: true, reopened: true });
  }),
);
