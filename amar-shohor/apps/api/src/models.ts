import mongoose, { Schema, type Model, type Types } from 'mongoose';
import { CATEGORIES, DEPARTMENTS, ROLES, STATUSES } from '@amar/shared';
import type { Category, Department, GeoPoint, Role, Status } from '@amar/shared';

/**
 * Phase 03 — the data model.
 *
 * The distinction the whole product rests on: a `Report` is one citizen
 * submission, an `Issue` is the verified cluster those reports collapse into.
 * `StatusEvent` is append-only — the public timeline and the audit log are the
 * same rows, so there is no way to quietly rewrite history.
 *
 * Document shapes are written out as interfaces rather than derived with
 * mongoose's InferSchemaType. Inference on schemas this size costs several
 * gigabytes of compiler heap and produces types nobody can read in an editor
 * tooltip; declaring them is cheaper and self-documenting.
 */

// --- shared field shapes ----------------------------------------------------

export interface PhotoDoc {
  id: string;
  key: string;
  url: string;
  thumbUrl: string;
  width?: number;
  height?: number;
  bytes?: number;
  /**
   * Kept for the phase 09 integrity checks, never served publicly — the
   * serialiser in serialize.ts drops it.
   */
  exif?: {
    capturedAt?: Date;
    lat?: number;
    lng?: number;
    make?: string;
    model?: string;
  };
}

export interface PriorityFactorDoc {
  key: string;
  label: string;
  value: number;
  weight: number;
  points: number;
  detail: string;
}

export interface AiVerdictDoc {
  model?: string;
  category?: Category;
  categoryConfidence?: number;
  severity?: number;
  relevant?: boolean;
  embedding?: number[];
  integrity?: {
    exifGpsDriftM?: number;
    captureToSubmitMinutes?: number;
    screenshotSuspected?: boolean;
    reusedImage?: boolean;
  };
  overriddenByUser?: boolean;
  at?: Date;
}

const geoPoint = {
  type: { type: String, enum: ['Point'], required: true, default: 'Point' },
  coordinates: {
    type: [Number],
    required: true,
    validate: {
      validator: (v: number[]) => v.length === 2,
      message: 'coordinates must be [lng, lat]',
    },
  },
};

const photoSchema = new Schema<PhotoDoc>(
  {
    id: { type: String, required: true },
    key: { type: String, required: true },
    url: { type: String, required: true },
    thumbUrl: { type: String, required: true },
    width: Number,
    height: Number,
    bytes: Number,
    exif: {
      capturedAt: Date,
      lat: Number,
      lng: Number,
      make: String,
      model: String,
    },
  },
  { _id: false },
);

// --- Ward -------------------------------------------------------------------

export interface WardDoc {
  name: string;
  nameBn: string;
  cityCorporation: string;
  densityPerKm2: number;
  center?: GeoPoint;
  /** Polygon, so a report is stamped with its ward on write, not on read. */
  boundary?: { type: 'Polygon'; coordinates: number[][][] };
  createdAt?: Date;
  updatedAt?: Date;
}

const wardSchema = new Schema<WardDoc>(
  {
    name: { type: String, required: true },
    nameBn: { type: String, required: true },
    cityCorporation: { type: String, required: true },
    densityPerKm2: { type: Number, required: true },
    center: geoPoint,
    boundary: {
      type: { type: String, enum: ['Polygon'], default: 'Polygon' },
      coordinates: { type: [[[Number]]] },
    },
  },
  { timestamps: true },
);
wardSchema.index({ boundary: '2dsphere' });
wardSchema.index({ center: '2dsphere' });

// --- User -------------------------------------------------------------------

export interface UserDoc {
  /**
   * Email is the only sign-in identifier. Phone is kept as a contact detail
   * for the phase 13 SMS notifications and is never used to authenticate.
   */
  phone?: string;
  email: string;
  /** scrypt, written by hashPassword(). Never leaves the API. */
  passwordHash: string;
  name: string;
  role: Role;
  department?: Department;
  wardIds?: Types.ObjectId[];
  /**
   * Phase 04 — rises with confirmed reports, falls with rejected ones. Used to
   * weight verification votes so a fresh account cannot swing an issue alone.
   */
  trust: number;
  reportCount: number;
  verifiedCount: number;
  lastSeenAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    // Sparse, because most accounts have no phone number at all and a plain
    // `unique` index would collide every such row on null.
    phone: { type: String, unique: true, sparse: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // `select: false` so no query can leak the hash by forgetting to exclude
    // it — the two places that need it ask for it explicitly.
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true },
    role: { type: String, enum: ROLES, default: 'citizen', index: true },
    department: { type: String, enum: DEPARTMENTS },
    wardIds: [{ type: Schema.Types.ObjectId, ref: 'Ward' }],
    trust: { type: Number, default: 1, min: 0, max: 5 },
    reportCount: { type: Number, default: 0 },
    verifiedCount: { type: Number, default: 0 },
    lastSeenAt: Date,
  },
  { timestamps: true },
);

// --- Upload -----------------------------------------------------------------

export interface UploadDoc {
  photo: PhotoDoc;
  ownerId: Types.ObjectId;
  claimedAt?: Date;
  expiresAt: Date;
}

/**
 * A photo that has been stored but not yet attached to a report. The client
 * submits photo *ids*, never URLs, so a forged URL cannot end up on the map.
 * Unclaimed rows expire on their own.
 */
const uploadSchema = new Schema<UploadDoc>({
  photo: { type: photoSchema, required: true },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  claimedAt: Date,
  expiresAt: { type: Date, required: true },
});
uploadSchema.index({ 'photo.id': 1 }, { unique: true });
uploadSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// --- StaffCode --------------------------------------------------------------

/**
 * An invitation to create an authority account.
 *
 * The single shared `STAFF_SIGNUP_CODE` in the environment is a bootstrap: it
 * exists so the first admin can get in on a fresh database. Everything after
 * that should be one of these — issued by a named admin, scoped to a
 * department, countable, expirable, and revocable the moment it leaks.
 *
 * The code is stored in the clear, unlike a password. It has to be: an admin
 * needs to read it back off the screen to hand it to someone. That is exactly
 * why it is short-lived and use-capped instead.
 */
export interface StaffCodeDoc {
  code: string;
  /** Pins the account to a department, so the holder cannot pick another. */
  department?: Department;
  /** What this code was handed out for — shown in the admin list. */
  label?: string;
  createdById?: Types.ObjectId;
  createdByName?: string;
  expiresAt?: Date;
  /** null/undefined means unlimited. */
  maxUses?: number;
  useCount: number;
  lastUsedAt?: Date;
  /** Revoked rather than deleted, so a code that was used leaves a trail. */
  revokedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const staffCodeSchema = new Schema<StaffCodeDoc>(
  {
    code: { type: String, required: true, unique: true, trim: true },
    department: { type: String, enum: DEPARTMENTS },
    label: String,
    createdById: { type: Schema.Types.ObjectId, ref: 'User' },
    createdByName: String,
    expiresAt: Date,
    maxUses: { type: Number, min: 1 },
    useCount: { type: Number, default: 0 },
    lastUsedAt: Date,
    revokedAt: Date,
  },
  { timestamps: true },
);
// Not a TTL index: an expired code stays listed, greyed out, so an admin can
// see what they issued. Expiry is enforced when the code is used.
staffCodeSchema.index({ createdAt: -1 });

// --- Report -----------------------------------------------------------------

export interface ReportDoc {
  ref: string;
  category: Category;
  severity: number;
  description?: string;
  location: GeoPoint;
  accuracy?: number;
  address?: string;
  photos: PhotoDoc[];
  reporterId?: Types.ObjectId;
  wardId?: Types.ObjectId;
  ai?: AiVerdictDoc;
  /** Set once dedup attached it. Null means it is still in the review queue. */
  issueId?: Types.ObjectId | null;
  mergeConfidence?: number;
  mergeDecision?: 'auto' | 'reviewed' | 'new' | 'pending';
  queuedOffline?: boolean;
  capturedAt?: Date;
  rejectedReason?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const aiVerdictSchema = new Schema<AiVerdictDoc>(
  {
    model: String,
    category: { type: String, enum: CATEGORIES },
    categoryConfidence: Number,
    severity: Number,
    relevant: Boolean,
    embedding: { type: [Number], default: undefined },
    integrity: {
      exifGpsDriftM: Number,
      captureToSubmitMinutes: Number,
      screenshotSuspected: Boolean,
      reusedImage: Boolean,
    },
    overriddenByUser: Boolean,
    at: Date,
  },
  { _id: false },
);

const reportSchema = new Schema<ReportDoc>(
  {
    ref: { type: String, required: true, unique: true },
    category: { type: String, enum: CATEGORIES, required: true, index: true },
    severity: { type: Number, min: 1, max: 5, default: 3 },
    description: String,
    location: geoPoint,
    accuracy: Number,
    address: String,
    photos: { type: [photoSchema], default: [] },
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    wardId: { type: Schema.Types.ObjectId, ref: 'Ward', index: true },
    ai: aiVerdictSchema,
    issueId: { type: Schema.Types.ObjectId, ref: 'Issue', index: true },
    mergeConfidence: Number,
    mergeDecision: {
      type: String,
      enum: ['auto', 'reviewed', 'new', 'pending'],
      default: 'pending',
      index: true,
    },
    queuedOffline: Boolean,
    capturedAt: Date,
    rejectedReason: String,
  },
  { timestamps: true },
);
reportSchema.index({ location: '2dsphere' });
reportSchema.index({ createdAt: -1 });

// --- Issue ------------------------------------------------------------------

export interface IssueDoc {
  ref: string;
  title: string;
  category: Category;
  status: Status;
  severity: number;
  description?: string;
  /** The centroid of the merged reports, recomputed on every merge. */
  location: GeoPoint;
  address?: string;
  wardId?: Types.ObjectId;

  reportIds: Types.ObjectId[];
  reportCount: number;
  photos: PhotoDoc[];
  proofPhotos: PhotoDoc[];

  /** Denormalised so the map can sort by priority without recomputing. */
  priorityScore: number;
  priorityBand: 'critical' | 'high' | 'medium' | 'low';
  priorityFactors: PriorityFactorDoc[];

  /** Mean of the merged reports' image embeddings — the dedup anchor. */
  embedding?: number[];

  confirms: number;
  disputes: number;
  weightedConfirms: number;
  weightedDisputes: number;

  assigneeId?: Types.ObjectId;
  department?: Department;
  slaDueAt?: Date;
  assignedAt?: Date;
  verifiedAt?: Date;
  resolvedAt?: Date;
  firstReportAt: Date;
  /** Only a reporter's own sign-off counts toward resolution statistics. */
  citizenSignedOffAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const priorityFactorSchema = new Schema<PriorityFactorDoc>(
  { key: String, label: String, value: Number, weight: Number, points: Number, detail: String },
  { _id: false },
);

const issueSchema = new Schema<IssueDoc>(
  {
    ref: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    category: { type: String, enum: CATEGORIES, required: true, index: true },
    status: { type: String, enum: STATUSES, default: 'reported', index: true },
    severity: { type: Number, min: 1, max: 5, default: 3 },
    description: String,
    location: geoPoint,
    address: String,
    wardId: { type: Schema.Types.ObjectId, ref: 'Ward', index: true },

    reportIds: [{ type: Schema.Types.ObjectId, ref: 'Report' }],
    reportCount: { type: Number, default: 1, index: true },
    photos: { type: [photoSchema], default: [] },
    proofPhotos: { type: [photoSchema], default: [] },

    priorityScore: { type: Number, default: 0, index: true },
    priorityBand: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low'],
      default: 'low',
      index: true,
    },
    priorityFactors: { type: [priorityFactorSchema], default: [] },

    embedding: { type: [Number], default: undefined },

    confirms: { type: Number, default: 0 },
    disputes: { type: Number, default: 0 },
    weightedConfirms: { type: Number, default: 0 },
    weightedDisputes: { type: Number, default: 0 },

    assigneeId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    department: { type: String, enum: DEPARTMENTS, index: true },
    slaDueAt: Date,
    assignedAt: Date,
    verifiedAt: Date,
    resolvedAt: Date,
    firstReportAt: { type: Date, required: true },
    citizenSignedOffAt: Date,
  },
  { timestamps: true },
);
issueSchema.index({ location: '2dsphere' });
issueSchema.index({ status: 1, priorityScore: -1 });
issueSchema.index({ department: 1, status: 1, slaDueAt: 1 });

// --- StatusEvent (append-only) ---------------------------------------------

export interface StatusEventDoc {
  issueId: Types.ObjectId;
  status: Status;
  from?: Status;
  note?: string;
  actorId?: Types.ObjectId;
  actorName?: string;
  actorRole?: Role;
  proofPhotos?: PhotoDoc[];
  at?: Date;
}

const statusEventSchema = new Schema<StatusEventDoc>({
  issueId: { type: Schema.Types.ObjectId, ref: 'Issue', required: true, index: true },
  status: { type: String, enum: STATUSES, required: true },
  from: { type: String, enum: STATUSES },
  note: String,
  actorId: { type: Schema.Types.ObjectId, ref: 'User' },
  actorName: String,
  actorRole: { type: String, enum: ROLES },
  proofPhotos: { type: [photoSchema], default: [] },
  at: { type: Date, default: () => new Date(), index: true },
});

// Refuse updates and deletes at the model layer, not just by convention.
const APPEND_ONLY = [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
] as const;
for (const op of APPEND_ONLY) {
  statusEventSchema.pre(op as 'updateOne', function () {
    throw new Error('StatusEvent is append-only: the public timeline and the audit log are the same data');
  });
}

// --- Verification -----------------------------------------------------------

export interface VerificationDoc {
  issueId: Types.ObjectId;
  userId: Types.ObjectId;
  vote: 'confirm' | 'dispute';
  /** Snapshot of the voter's trust at vote time, so history stays reproducible. */
  weight: number;
  distanceM?: number;
  note?: string;
  at?: Date;
}

const verificationSchema = new Schema<VerificationDoc>({
  issueId: { type: Schema.Types.ObjectId, ref: 'Issue', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  vote: { type: String, enum: ['confirm', 'dispute'], required: true },
  weight: { type: Number, default: 1 },
  distanceM: Number,
  note: String,
  at: { type: Date, default: () => new Date() },
});
verificationSchema.index({ issueId: 1, userId: 1 }, { unique: true });

// --- Exports ----------------------------------------------------------------

const m = <T>(name: string, schema: Schema<T>): Model<T> =>
  (mongoose.models[name] as Model<T> | undefined) ?? mongoose.model<T>(name, schema);

export const Ward = m<WardDoc>('Ward', wardSchema);
export const User = m<UserDoc>('User', userSchema);
export const Upload = m<UploadDoc>('Upload', uploadSchema);
export const StaffCode = m<StaffCodeDoc>('StaffCode', staffCodeSchema);
export const Report = m<ReportDoc>('Report', reportSchema);
export const Issue = m<IssueDoc>('Issue', issueSchema);
export const StatusEvent = m<StatusEventDoc>('StatusEvent', statusEventSchema);
export const Verification = m<VerificationDoc>('Verification', verificationSchema);
