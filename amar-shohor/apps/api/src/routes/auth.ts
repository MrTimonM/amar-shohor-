import type { HydratedDocument } from 'mongoose';
import { Router } from 'express';
import { DEPARTMENTS, DEPARTMENT_LABELS, loginSchema, signupSchema, type Department } from '@amar/shared';
import { hashPassword, rateLimit, requireUser, signToken, verifyPassword } from '../auth';
import { env } from '../env';
import { HttpError, parse, route } from '../http';
import { log } from '../log';
import { StaffCode, User, type StaffCodeDoc, type UserDoc } from '../models';
import { me as serializeMe } from '../serialize';

/**
 * Sign-up and sign-in: name, email, password.
 *
 * There is no email confirmation step. A confirmation mail is only worth its
 * friction when the address has to be reachable — and nothing here mails
 * anyone. Requiring it would mean an account that cannot be used until a
 * message that is never sent arrives.
 *
 * Two entities sign in through the same endpoint. A citizen account is
 * self-service; an authority account additionally needs a department and the
 * staff code, because the difference between the two is the power to close a
 * problem on the public record.
 */
export const authRouter = Router();

/** Never log a whole address. */
const maskEmail = (email: string) => email.replace(/^(.{2}).*(@.*)$/, '$1***$2');

/**
 * One message for "no such account" and "wrong password". Distinguishing them
 * turns the login form into a test for whether an address has an account here,
 * which is exactly what someone probing a list of leaked addresses wants.
 */
const BAD_CREDENTIALS = 'That email and password do not match. Check both and try again.';

authRouter.post(
  '/signup',
  rateLimit({ windowMs: 10 * 60_000, max: 10, key: (req) => String(req.body?.email ?? req.ip) }),
  route(async (req, res) => {
    const { name, email, password, department, staffCode } = parse(signupSchema, req.body);

    const wantsStaff = Boolean(department || staffCode);

    /**
     * Two kinds of code. An issued `StaffCode` row is the real mechanism —
     * scoped, counted, expiring, revocable. The single environment code is a
     * bootstrap so the first admin can get in on an empty database, and a
     * deployment that has finished bootstrapping should blank it.
     */
    let issued: HydratedDocument<StaffCodeDoc> | null = null;

    if (wantsStaff) {
      if (!staffCode) {
        throw HttpError.badRequest('An authority account needs a staff code from your city.');
      }

      issued = await StaffCode.findOne({ code: staffCode.toUpperCase() });

      if (issued) {
        if (issued.revokedAt) throw HttpError.badRequest('That staff code has been withdrawn. Ask for a new one.');
        if (issued.expiresAt && issued.expiresAt.valueOf() < Date.now()) {
          throw HttpError.badRequest('That staff code has expired. Ask for a new one.');
        }
        if (issued.maxUses != null && (issued.useCount ?? 0) >= issued.maxUses) {
          throw HttpError.badRequest('That staff code has already been used its full number of times.');
        }
        // A code issued for a department pins the account to it, so the holder
        // cannot quietly sign themselves into a different one.
        if (issued.department && department && issued.department !== department) {
          throw HttpError.badRequest(`That code is for the ${issued.department} department.`);
        }
      } else if (!env.STAFF_SIGNUP_CODE || staffCode !== env.STAFF_SIGNUP_CODE) {
        throw HttpError.badRequest('That staff code is not right. Ask your department for the current one.');
      }

      if (!issued?.department && !department) {
        throw HttpError.badRequest('Pick the department this account belongs to.');
      }
    }

    const staffDepartment = (issued?.department ?? department) as Department | undefined;

    // A unique index backs this too; checking first turns a driver error into
    // a sentence someone can act on.
    if (await User.exists({ email })) {
      throw HttpError.conflict('An account already uses that email. Sign in instead.');
    }

    const user = await User.create({
      name,
      email,
      passwordHash: await hashPassword(password),
      role: wantsStaff ? 'authority' : 'citizen',
      department: wantsStaff ? staffDepartment : undefined,
      // Staff are trusted by appointment; a citizen earns it by reporting.
      trust: wantsStaff ? 5 : 1,
      lastSeenAt: new Date(),
    });

    // Counted only once the account actually exists, so a signup that failed
    // validation does not burn a use off the code.
    if (issued) {
      issued.useCount = (issued.useCount ?? 0) + 1;
      issued.lastUsedAt = new Date();
      await issued.save();
    }

    log.info('account created', { id: String(user._id), role: user.role, email: maskEmail(email) });

    res.status(201).json({
      token: signToken(String(user._id)),
      user: serializeMe(user.toObject() as UserDoc & { _id: unknown }),
    });
  }),
);

authRouter.post(
  '/login',
  rateLimit({ windowMs: 10 * 60_000, max: 12, key: (req) => String(req.body?.email ?? req.ip) }),
  route(async (req, res) => {
    const { email, password } = parse(loginSchema, req.body);

    // passwordHash is `select: false`, so it has to be asked for by name.
    const user = await User.findOne({ email }).select('+passwordHash');

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      // Both branches take a scrypt's worth of time only when the account
      // exists; the rate limiter above is what bounds the difference.
      throw HttpError.unauthorized(BAD_CREDENTIALS);
    }

    user.lastSeenAt = new Date();
    await user.save();

    log.info('signed in', { id: String(user._id), role: user.role });

    res.json({
      token: signToken(String(user._id)),
      user: serializeMe(user.toObject() as UserDoc & { _id: unknown }),
    });
  }),
);

authRouter.get(
  '/me',
  route(async (req, res) => {
    const auth = requireUser(req);
    const user = await User.findById(auth.id).lean<UserDoc & { _id: unknown }>();
    if (!user) throw HttpError.notFound('That account no longer exists');
    res.json(serializeMe(user));
  }),
);

/**
 * What the sign-up form needs to render the authority side: the departments
 * that exist, and whether this server is issuing staff accounts at all. The
 * form asks before showing a staff-code field it might not be able to honour.
 */
authRouter.get(
  '/departments',
  route(async (_req, res) => {
    // Open if either mechanism can currently admit someone: a live issued code,
    // or the environment bootstrap.
    const liveCodes = await StaffCode.countDocuments({
      revokedAt: { $exists: false },
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }],
    });

    res.json({
      staffSignupOpen: Boolean(env.STAFF_SIGNUP_CODE) || liveCodes > 0,
      departments: DEPARTMENTS.map((key) => ({ key, ...DEPARTMENT_LABELS[key] })),
    });
  }),
);
