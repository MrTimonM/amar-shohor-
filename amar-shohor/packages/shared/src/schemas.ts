import { z } from 'zod';
import { CATEGORIES, DEPARTMENTS, ROLES, STATUSES } from './domain';

/**
 * Zod is the single source of truth for request and response shapes. The API
 * validates with these; the web app infers its TypeScript types from the same
 * objects, so a field can never drift between the two.
 */

export const lngLat = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);

export const geoPointSchema = z.object({
  type: z.literal('Point'),
  coordinates: lngLat,
});

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter an email address that looks like name@example.com')
  .max(254);

/**
 * Sign-in: name, email and a password. There is no email confirmation step —
 * an account works the moment it is created.
 *
 * The minimum length is 8 rather than a character-class rule. Length is what
 * actually resists guessing, and composition rules mostly produce `Passw0rd!`.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(128, 'That password is too long');

export const signupSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(60),
  email: emailSchema,
  password: passwordSchema,
  /**
   * A department turns the account into an authority one, but only alongside
   * the staff code — otherwise anyone could appoint themselves to the city.
   */
  department: z.enum(DEPARTMENTS).optional(),
  staffCode: z.string().trim().max(120).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(128),
});

/**
 * Issuing a staff code. Every field but the department is optional, because
 * the safe defaults (short expiry, few uses) are applied server-side — an
 * admin in a hurry should not be able to mint an unlimited eternal code by
 * leaving the form alone.
 */
export const createStaffCodeSchema = z.object({
  department: z.enum(DEPARTMENTS).optional(),
  label: z.string().trim().max(80).optional(),
  /** Days until it stops working. Omitted means the server's default. */
  expiresInDays: z.number().int().min(1).max(365).optional(),
  /** How many accounts it may create. Omitted means the server's default. */
  maxUses: z.number().int().min(1).max(500).optional(),
});

export const updateRoleSchema = z.object({
  role: z.enum(ROLES),
  department: z.enum(DEPARTMENTS).optional(),
  wardIds: z.array(z.string()).optional(),
});

export const createReportSchema = z.object({
  category: z.enum(CATEGORIES),
  /** Optional: the vision model fills it in when the citizen skips it. */
  severity: z.number().int().min(1).max(5).optional(),
  description: z.string().trim().max(1000).optional(),
  location: geoPointSchema,
  /** Metres of GPS uncertainty the browser reported, kept for integrity checks. */
  accuracy: z.number().min(0).max(10_000).optional(),
  photoIds: z.array(z.string().min(1)).min(1, 'A photo is required').max(4),
  /** Set when the citizen tapped an existing issue instead of filing a new one. */
  confirmsIssueId: z.string().optional(),
  /** True when the report was queued offline and flushed later (phase 05). */
  queuedOffline: z.boolean().optional(),
  capturedAt: z.coerce.date().optional(),
});

export const issueQuerySchema = z.object({
  /** Viewport as "west,south,east,north" — the map never asks for the whole city. */
  bbox: z
    .string()
    .regex(/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/)
    .optional(),
  category: z.string().optional(),
  status: z.string().optional(),
  ward: z.string().optional(),
  band: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  since: z.coerce.date().optional(),
  q: z.string().trim().max(120).optional(),
  sort: z.enum(['priority', 'newest', 'oldest', 'reports']).default('priority'),
  limit: z.coerce.number().int().min(1).max(500).default(120),
  cursor: z.string().optional(),
});

export const verifySchema = z.object({
  vote: z.enum(['confirm', 'dispute']),
  /** Proximity-gated: the server checks this against the issue location. */
  at: geoPointSchema,
  note: z.string().trim().max(300).optional(),
});

export const statusChangeSchema = z.object({
  to: z.enum(STATUSES),
  note: z.string().trim().min(3, 'A note is required on every status change').max(600),
  /** Required by the server when moving to resolved (phase 13). */
  proofPhotoIds: z.array(z.string()).max(4).optional(),
  assigneeId: z.string().optional(),
});

export const mergeDecisionSchema = z.object({
  reportId: z.string().min(1),
  action: z.enum(['merge', 'split', 'reject']),
  targetIssueId: z.string().optional(),
  note: z.string().trim().max(300).optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateReportInput = z.infer<typeof createReportSchema>;
export type IssueQuery = z.infer<typeof issueQuerySchema>;
export type VerifyInput = z.infer<typeof verifySchema>;
export type StatusChangeInput = z.infer<typeof statusChangeSchema>;
export type MergeDecisionInput = z.infer<typeof mergeDecisionSchema>;
export type CreateStaffCodeInput = z.infer<typeof createStaffCodeSchema>;
