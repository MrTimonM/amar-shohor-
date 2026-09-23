import crypto from 'node:crypto';
import { Router } from 'express';
import { createStaffCodeSchema, updateRoleSchema, type Department } from '@amar/shared';
import { requireRole, requireUser } from '../auth';
import { HttpError, parse, route } from '../http';
import { log } from '../log';
import { Issue, StaffCode, User, type StaffCodeDoc, type UserDoc } from '../models';

/**
 * The admin console.
 *
 * Authority accounts are the ones that can close a problem on the public
 * record, so who holds one has to be visible and reversible. This router is
 * the whole of that: who the staff are, what invitations are outstanding, and
 * a way to withdraw either.
 *
 * Every route is admin-only. `requireRole` is middleware rather than a UI
 * check because a hidden button is not an access control.
 */
export const adminRouter = Router();

adminRouter.use(requireRole('admin'));

/** Sensible ceilings applied when the form leaves them out. */
const DEFAULT_EXPIRY_DAYS = 14;
const DEFAULT_MAX_USES = 5;

/**
 * Crockford-ish base32 over CSPRNG bytes: no 0/O or 1/I/L to confuse, and
 * grouped so it can be read down a phone line without a second attempt.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function newCode(): string {
  const bytes = crypto.randomBytes(12);
  const chars = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

/** Derived, not stored — so a code cannot be listed as live after it expires. */
function codeState(doc: StaffCodeDoc): 'active' | 'revoked' | 'expired' | 'used_up' {
  if (doc.revokedAt) return 'revoked';
  if (doc.expiresAt && doc.expiresAt.valueOf() < Date.now()) return 'expired';
  if (doc.maxUses !== undefined && doc.maxUses !== null && doc.useCount >= doc.maxUses) return 'used_up';
  return 'active';
}

const serializeCode = (doc: StaffCodeDoc & { _id: unknown }) => ({
  id: String(doc._id),
  code: doc.code,
  department: doc.department ?? null,
  label: doc.label ?? null,
  createdByName: doc.createdByName ?? null,
  createdAt: doc.createdAt?.toISOString() ?? null,
  expiresAt: doc.expiresAt?.toISOString() ?? null,
  maxUses: doc.maxUses ?? null,
  useCount: doc.useCount ?? 0,
  lastUsedAt: doc.lastUsedAt?.toISOString() ?? null,
  state: codeState(doc),
});

// --- staff codes ------------------------------------------------------------

adminRouter.get(
  '/staff-codes',
  route(async (_req, res) => {
    const docs = await StaffCode.find().sort({ createdAt: -1 }).limit(200).lean<(StaffCodeDoc & { _id: unknown })[]>();
    res.json({ items: docs.map(serializeCode) });
  }),
);

adminRouter.post(
  '/staff-codes',
  route(async (req, res) => {
    const auth = requireUser(req);
    const { department, label, expiresInDays, maxUses } = parse(createStaffCodeSchema, req.body);

    const doc = await StaffCode.create({
      code: newCode(),
      department,
      label,
      createdById: auth.id,
      createdByName: auth.name,
      expiresAt: new Date(Date.now() + (expiresInDays ?? DEFAULT_EXPIRY_DAYS) * 86_400_000),
      maxUses: maxUses ?? DEFAULT_MAX_USES,
      useCount: 0,
    });

    log.info('staff code issued', { id: String(doc._id), by: auth.id, department: department ?? 'any' });
    res.status(201).json(serializeCode(doc.toObject() as StaffCodeDoc & { _id: unknown }));
  }),
);

/**
 * Revoke, which is the default and what the UI calls "delete": the row stays
 * so a code that has already created accounts leaves a trail of what it was
 * and who issued it. `?hard=1` removes it outright, which is only reasonable
 * for a code nobody ever used.
 */
adminRouter.delete(
  '/staff-codes/:id',
  route(async (req, res) => {
    const auth = requireUser(req);
    const doc = await StaffCode.findById(req.params.id);
    if (!doc) throw HttpError.notFound('That code does not exist.');

    if (req.query.hard === '1') {
      if ((doc.useCount ?? 0) > 0) {
        throw HttpError.conflict(
          'That code has already created accounts, so it cannot be erased. Revoke it instead — it stops working immediately either way.',
        );
      }
      await doc.deleteOne();
      log.info('staff code deleted', { id: String(doc._id), by: auth.id });
      return res.json({ ok: true, deleted: true });
    }

    if (!doc.revokedAt) {
      doc.revokedAt = new Date();
      await doc.save();
    }
    log.info('staff code revoked', { id: String(doc._id), by: auth.id });
    return res.json({ ok: true, revoked: true });
  }),
);

// --- staff accounts ---------------------------------------------------------

adminRouter.get(
  '/staff',
  route(async (_req, res) => {
    const docs = await User.find({ role: { $in: ['authority', 'admin', 'verifier'] } })
      .sort({ role: 1, name: 1 })
      .lean<(UserDoc & { _id: unknown })[]>();

    // One aggregate rather than a query per person: this list is short, but
    // the N+1 would still be N+1.
    const counts = await Issue.aggregate<{ _id: unknown; open: number }>([
      { $match: { assigneeId: { $in: docs.map((d) => d._id) }, status: { $nin: ['resolved', 'rejected'] } } },
      { $group: { _id: '$assigneeId', open: { $sum: 1 } } },
    ]);
    const openBy = new Map(counts.map((c) => [String(c._id), c.open]));

    res.json({
      items: docs.map((doc) => ({
        id: String(doc._id),
        name: doc.name,
        email: doc.email,
        role: doc.role,
        department: doc.department ?? null,
        trust: doc.trust ?? 1,
        lastSeenAt: doc.lastSeenAt?.toISOString() ?? null,
        createdAt: doc.createdAt?.toISOString() ?? null,
        openAssigned: openBy.get(String(doc._id)) ?? 0,
      })),
    });
  }),
);

adminRouter.patch(
  '/staff/:id',
  route(async (req, res) => {
    const auth = requireUser(req);
    const { role, department } = parse(updateRoleSchema, req.body);

    if (req.params.id === auth.id && role !== 'admin') {
      // Removing your own admin rights on a system whose only admin you are
      // locks everyone out, and there is no password reset to climb back in.
      throw HttpError.badRequest('You cannot remove your own admin role.');
    }

    const user = await User.findById(req.params.id);
    if (!user) throw HttpError.notFound('That account does not exist.');

    user.role = role;
    user.department = role === 'authority' ? (department as Department | undefined) : undefined;
    await user.save();

    log.info('role changed', { id: String(user._id), to: role, by: auth.id });
    res.json({ ok: true, id: String(user._id), role: user.role, department: user.department ?? null });
  }),
);

/**
 * Demote to citizen rather than delete the row. The account authored status
 * events and may be the assignee on open issues; deleting it would leave the
 * public timeline pointing at nothing. `?hard=1` deletes outright, and is
 * refused while anything is still assigned to them.
 */
adminRouter.delete(
  '/staff/:id',
  route(async (req, res) => {
    const auth = requireUser(req);
    if (req.params.id === auth.id) throw HttpError.badRequest('You cannot remove your own account.');

    const user = await User.findById(req.params.id);
    if (!user) throw HttpError.notFound('That account does not exist.');

    const openAssigned = await Issue.countDocuments({
      assigneeId: user._id,
      status: { $nin: ['resolved', 'rejected'] },
    });

    if (req.query.hard === '1') {
      if (openAssigned > 0) {
        throw HttpError.conflict(
          `${user.name} still has ${openAssigned} open problem${openAssigned === 1 ? '' : 's'} assigned. Reassign them first, or revoke the role instead of deleting the account.`,
        );
      }
      await user.deleteOne();
      log.info('staff account deleted', { id: String(user._id), by: auth.id });
      return res.json({ ok: true, deleted: true });
    }

    user.role = 'citizen';
    user.department = undefined;
    await user.save();

    log.info('staff access revoked', { id: String(user._id), by: auth.id });
    return res.json({ ok: true, demoted: true, openAssigned });
  }),
);
