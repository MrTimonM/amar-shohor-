import type { Category, Department, Role, Status } from './domain';
import type { GeoPoint } from './geo';
import type { PriorityResult } from './priority';

/** Response shapes. The web app imports these instead of redeclaring them. */

export interface Photo {
  id: string;
  url: string;
  thumbUrl: string;
  width?: number;
  height?: number;
}

export interface AiVerdict {
  /** Which registry entry produced this, e.g. "category-clip@0.1.0". */
  model: string;
  category?: Category;
  categoryConfidence?: number;
  severity?: number;
  /** Rejected before publication: selfie, screenshot, indoor, explicit. */
  relevant?: boolean;
  /** Integrity signals bundled together, phase 09. */
  integrity?: {
    exifGpsDriftM?: number;
    captureToSubmitMinutes?: number;
    screenshotSuspected?: boolean;
    reusedImage?: boolean;
  };
  /** Whether the citizen overrode the prediction — logged as training signal. */
  overriddenByUser?: boolean;
  at: string;
}

export interface ReportSummary {
  id: string;
  ref: string;
  category: Category;
  severity: number;
  description?: string;
  location: GeoPoint;
  photos: Photo[];
  createdAt: string;
  queuedOffline?: boolean;
  reporter?: { id: string; name: string; trust: number };
  ai?: AiVerdict;
  /** Set once dedup attached it to an issue. */
  issueId?: string;
  /** How the merge was decided, so the moderator console can be audited. */
  mergeConfidence?: number;
  mergeDecision?: 'auto' | 'reviewed' | 'new' | 'pending';
}

export interface StatusEventView {
  id: string;
  from?: Status;
  status: Status;
  note?: string;
  actor: { name: string; role: Role };
  proofPhotos?: Photo[];
  at: string;
}

export interface VerificationSummary {
  confirms: number;
  disputes: number;
  /** Trust-weighted totals — a new account cannot swing an issue alone. */
  weightedConfirms: number;
  weightedDisputes: number;
  threshold: number;
  /** Whether the signed-in user has already voted, and how. */
  myVote?: 'confirm' | 'dispute';
  /** False when the user is too far away to vote (phase 12 proximity gate). */
  eligible?: boolean;
  distanceM?: number;
}

export interface WardSummary {
  id: string;
  name: string;
  nameBn: string;
  cityCorporation: string;
  densityPerKm2: number;
}

export interface IssueSummary {
  id: string;
  ref: string;
  title: string;
  category: Category;
  status: Status;
  severity: number;
  location: GeoPoint;
  address?: string;
  ward?: WardSummary;
  reportCount: number;
  photos: Photo[];
  priority: PriorityResult;
  createdAt: string;
  updatedAt: string;
  /** Deadline derived from the category SLA at assignment time. */
  slaDueAt?: string;
  slaBreached?: boolean;
  verification: VerificationSummary;
  assignee?: { id: string; name: string; department: Department };
}

export interface IssueDetail extends IssueSummary {
  description?: string;
  /** Every report that merged in, for the "3 reports → 1 problem" proof card. */
  reports: ReportSummary[];
  timeline: StatusEventView[];
  proofPhotos: Photo[];
  nearby: IssueSummary[];
}

export interface Me {
  id: string;
  name: string;
  /** The sign-in identifier. */
  email: string;
  /** Contact detail only — phase 13 SMS notifications, never authentication. */
  phone?: string;
  role: Role;
  trust: number;
  department?: Department;
  wardIds?: string[];
  reportCount: number;
  verifiedCount: number;
}

export interface WardStat {
  ward: WardSummary;
  open: number;
  resolved: number;
  total: number;
  resolutionRate: number;
  /** Hours, median not mean — a few stale issues should not hide the typical case. */
  medianResolutionHours: number | null;
  slaBreaches: number;
}

export interface DashboardStats {
  totals: {
    issues: number;
    open: number;
    resolved: number;
    reports: number;
    duplicatesMerged: number;
    citizens: number;
  };
  resolutionRate: number;
  medianResolutionHours: number | null;
  byCategory: { category: Category; open: number; resolved: number }[];
  byStatus: { status: Status; count: number }[];
  /** Last 30 days, oldest first, for the trend line. */
  trend: { date: string; reported: number; resolved: number }[];
  wards: WardStat[];
  departments: { department: Department; open: number; slaBreaches: number; medianResolutionHours: number | null }[];
}

export interface Paginated<T> {
  items: T[];
  nextCursor?: string;
  total?: number;
}

export interface ApiError {
  error: string;
  message: string;
  /** Field-level messages, keyed by path, when validation failed. */
  fields?: Record<string, string>;
}
