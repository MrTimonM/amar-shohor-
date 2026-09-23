import { CATEGORY_META, type Category } from './domain';

/**
 * Phase 10 — the explainable priority score.
 *
 * A public accountability tool cannot rank problems with a black box, so the
 * score is a weighted sum of five named factors and every response carries the
 * per-factor contribution. The web app renders exactly this breakdown; it does
 * not recompute or approximate it.
 *
 * Phase 10's upgrade path replaces these hand-tuned weights with gradient
 * boosting trained on real resolution outcomes, keeping the same breakdown
 * shape via SHAP values — which is why the return type is factors, not a
 * bare number.
 */

export interface PriorityInput {
  category: Category;
  /** 1–5 from the vision model or a human override. */
  severity: number;
  /** How many distinct citizen reports merged into this issue. */
  reportCount: number;
  /** People per km² in the ward, normalised against DENSITY_CEILING. */
  wardDensity: number;
  /** Hours since the first report in the cluster. */
  ageHours: number;
}

export interface PriorityFactor {
  key: 'severity' | 'reports' | 'density' | 'age' | 'hazard';
  /** Shown to the user, so it reads as a sentence not a variable name. */
  label: string;
  /** 0–1, this factor's own normalised value. */
  value: number;
  /** Share of the total score this factor can contribute. */
  weight: number;
  /** value * weight, i.e. points actually added out of 100. */
  points: number;
  /** Plain-language reason, rendered verbatim in the breakdown panel. */
  detail: string;
}

export interface PriorityResult {
  /** 0–100, rounded. */
  score: number;
  band: 'critical' | 'high' | 'medium' | 'low';
  factors: PriorityFactor[];
}

/** Weights sum to 100 so `points` is directly readable as score contribution. */
export const PRIORITY_WEIGHTS = {
  severity: 32,
  reports: 24,
  density: 14,
  age: 18,
  hazard: 12,
} as const;

/** A ward at or above this density scores 1.0 on the density factor. */
export const DENSITY_CEILING = 45_000;
/** An issue open this long scores 1.0 on the age factor. */
export const AGE_CEILING_HOURS = 30 * 24;
/** This many merged reports scores 1.0 on the report-count factor. */
export const REPORTS_CEILING = 12;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function computePriority(input: PriorityInput): PriorityResult {
  const meta = CATEGORY_META[input.category];

  const severityValue = clamp01((input.severity - 1) / 4);
  // Log curve: the jump from 1 to 3 reports should matter more than 10 to 12.
  const reportsValue = clamp01(Math.log2(Math.max(1, input.reportCount)) / Math.log2(REPORTS_CEILING));
  const densityValue = clamp01(input.wardDensity / DENSITY_CEILING);
  const ageValue = clamp01(input.ageHours / AGE_CEILING_HOURS);
  const hazardValue = meta.hazard ? 1 : 0;

  const factors: PriorityFactor[] = [
    {
      key: 'severity',
      label: 'How bad it is',
      value: severityValue,
      weight: PRIORITY_WEIGHTS.severity,
      points: severityValue * PRIORITY_WEIGHTS.severity,
      detail: `Severity ${input.severity} of 5`,
    },
    {
      key: 'reports',
      label: 'How many people reported it',
      value: reportsValue,
      weight: PRIORITY_WEIGHTS.reports,
      points: reportsValue * PRIORITY_WEIGHTS.reports,
      detail: input.reportCount === 1 ? '1 report' : `${input.reportCount} reports merged`,
    },
    {
      key: 'density',
      label: 'How many people it affects',
      value: densityValue,
      weight: PRIORITY_WEIGHTS.density,
      points: densityValue * PRIORITY_WEIGHTS.density,
      detail: `${Math.round(input.wardDensity).toLocaleString('en-US')} people per km² in this ward`,
    },
    {
      key: 'age',
      label: 'How long it has been open',
      value: ageValue,
      weight: PRIORITY_WEIGHTS.age,
      points: ageValue * PRIORITY_WEIGHTS.age,
      detail: describeAge(input.ageHours),
    },
    {
      key: 'hazard',
      label: 'Safety risk',
      value: hazardValue,
      weight: PRIORITY_WEIGHTS.hazard,
      points: hazardValue * PRIORITY_WEIGHTS.hazard,
      detail: meta.hazard ? 'This category can cause injury' : 'Not flagged as a safety risk',
    },
  ];

  const score = Math.round(factors.reduce((sum, f) => sum + f.points, 0));

  return { score, band: bandFor(score), factors };
}

export function bandFor(score: number): PriorityResult['band'] {
  if (score >= 70) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

export const BAND_LABELS: Record<PriorityResult['band'], { en: string; bn: string }> = {
  critical: { en: 'Critical', bn: 'সংকটপূর্ণ' },
  high: { en: 'High', bn: 'উচ্চ' },
  medium: { en: 'Medium', bn: 'মধ্যম' },
  low: { en: 'Low', bn: 'নিম্ন' },
};

function describeAge(hours: number): string {
  if (hours < 24) return `Open ${Math.max(1, Math.round(hours))} hour${Math.round(hours) === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return `Open ${days} day${days === 1 ? '' : 's'}`;
}
