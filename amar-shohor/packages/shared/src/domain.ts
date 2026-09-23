/**
 * The eight problem types from the pitch deck, and the issue lifecycle.
 * This file is the single source of truth: the API validates against it,
 * the web app renders labels and colours from it, and the seed script
 * generates data with it.
 */

export const CATEGORIES = [
  'road_damage',
  'waterlogging',
  'garbage',
  'streetlight',
  'traffic_signal',
  'sidewalk',
  'congestion',
  'environmental',
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface CategoryMeta {
  /** English label. */
  en: string;
  /** Bengali label — phase 11 makes this the default. */
  bn: string;
  /** Which department normally owns it, used to route the triage queue. */
  department: Department;
  /** Hours before the SLA clock goes red (phase 13). */
  slaHours: number;
  /** Categories that can injure someone get a hazard weighting. */
  hazard: boolean;
}

export const DEPARTMENTS = ['roads', 'water', 'waste', 'electrical', 'traffic', 'environment'] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const DEPARTMENT_LABELS: Record<Department, { en: string; bn: string }> = {
  roads: { en: 'Roads & Infrastructure', bn: 'সড়ক ও অবকাঠামো' },
  water: { en: 'Water & Drainage', bn: 'পানি ও পয়ঃনিষ্কাশন' },
  waste: { en: 'Waste Management', bn: 'বর্জ্য ব্যবস্থাপনা' },
  electrical: { en: 'Street Lighting', bn: 'সড়ক বাতি' },
  traffic: { en: 'Traffic Control', bn: 'ট্রাফিক নিয়ন্ত্রণ' },
  environment: { en: 'Environment', bn: 'পরিবেশ' },
};

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  road_damage: { en: 'Damaged road or pothole', bn: 'ভাঙা রাস্তা বা গর্ত', department: 'roads', slaHours: 168, hazard: true },
  waterlogging: { en: 'Waterlogging or drainage', bn: 'জলাবদ্ধতা বা নর্দমা', department: 'water', slaHours: 72, hazard: true },
  garbage: { en: 'Garbage accumulation', bn: 'আবর্জনার স্তূপ', department: 'waste', slaHours: 48, hazard: false },
  streetlight: { en: 'Broken streetlight', bn: 'নষ্ট সড়ক বাতি', department: 'electrical', slaHours: 120, hazard: true },
  traffic_signal: { en: 'Damaged traffic signal', bn: 'নষ্ট ট্রাফিক সিগন্যাল', department: 'traffic', slaHours: 24, hazard: true },
  sidewalk: { en: 'Sidewalk damage', bn: 'ফুটপাত ক্ষতিগ্রস্ত', department: 'roads', slaHours: 240, hazard: false },
  congestion: { en: 'Traffic congestion', bn: 'যানজট', department: 'traffic', slaHours: 336, hazard: false },
  environmental: { en: 'Environmental hazard', bn: 'পরিবেশগত ঝুঁকি', department: 'environment', slaHours: 48, hazard: true },
};

/**
 * Lifecycle. Transitions are enforced server-side by TRANSITIONS below, so
 * no code path can silently skip a stage — the public timeline and the audit
 * log are the same data.
 */
export const STATUSES = ['reported', 'verified', 'assigned', 'in_progress', 'resolved', 'rejected'] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_META: Record<Status, { en: string; bn: string; tone: Tone; step: number }> = {
  reported: { en: 'Reported', bn: 'রিপোর্ট হয়েছে', tone: 'neutral', step: 1 },
  verified: { en: 'Verified', bn: 'যাচাই হয়েছে', tone: 'accent', step: 2 },
  assigned: { en: 'Assigned', bn: 'দায়িত্ব দেওয়া হয়েছে', tone: 'wait', step: 3 },
  in_progress: { en: 'In progress', bn: 'কাজ চলছে', tone: 'wait', step: 4 },
  resolved: { en: 'Resolved', bn: 'সমাধান হয়েছে', tone: 'ok', step: 5 },
  rejected: { en: 'Rejected', bn: 'বাতিল', tone: 'bad', step: 0 },
};

export type Tone = 'neutral' | 'accent' | 'ok' | 'wait' | 'bad';

/** Legal transitions. Anything absent here is rejected with 409. */
export const TRANSITIONS: Record<Status, readonly Status[]> = {
  reported: ['verified', 'rejected'],
  verified: ['assigned', 'rejected'],
  // Straight to resolved as well as through in_progress: a crew that fixes a
  // pothole the morning it lands should not have to tick "in progress" first
  // to record it. The proof-of-fix photo is what guards closure, not the
  // number of stages it passed through.
  assigned: ['in_progress', 'resolved', 'verified', 'rejected'],
  in_progress: ['resolved', 'assigned'],
  // A citizen who reopens a fix that did not hold sends it back to assigned.
  resolved: ['assigned'],
  rejected: [],
};

export function canTransition(from: Status, to: Status): boolean {
  return TRANSITIONS[from].includes(to);
}

export const ROLES = ['citizen', 'verifier', 'authority', 'admin'] as const;
export type Role = (typeof ROLES)[number];

/** 1–5. The vision model estimates it; a human can override. */
export const SEVERITY_LABELS: Record<number, { en: string; bn: string }> = {
  1: { en: 'Minor', bn: 'সামান্য' },
  2: { en: 'Noticeable', bn: 'লক্ষণীয়' },
  3: { en: 'Serious', bn: 'গুরুতর' },
  4: { en: 'Severe', bn: 'অতি গুরুতর' },
  5: { en: 'Dangerous', bn: 'বিপজ্জনক' },
};
