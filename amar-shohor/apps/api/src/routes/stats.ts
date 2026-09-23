import { Router } from 'express';
import { CATEGORIES, DEPARTMENTS, STATUSES, type Category, type DashboardStats, type Department, type Status } from '@amar/shared';
import { route } from '../http';
import { Issue, Report, User, Ward, type IssueDoc, type WardDoc } from '../models';
import { ward as serializeWard } from '../serialize';

export const statsRouter = Router();

/**
 * Phase 14 — the public accountability dashboard.
 *
 * Every figure here is public, deliberately. Median rather than mean
 * resolution time, because a handful of stale issues would otherwise hide the
 * typical case and make the number useless to a citizen.
 */
statsRouter.get(
  '/dashboard',
  route(async (_req, res) => {
    const [issues, wards, reportCount, citizens] = await Promise.all([
      Issue.find({}).select('category status wardId department resolvedAt firstReportAt slaDueAt createdAt').lean<
        (IssueDoc & { _id: unknown })[]
      >(),
      Ward.find({}).lean<(WardDoc & { _id: unknown })[]>(),
      Report.countDocuments({}),
      User.countDocuments({ role: 'citizen' }),
    ]);

    const resolved = issues.filter((i) => i.resolvedAt);
    const open = issues.filter((i) => !i.resolvedAt && i.status !== 'rejected');

    const hoursFor = (i: (typeof issues)[number]) =>
      (new Date(i.resolvedAt as Date).valueOf() - new Date(i.firstReportAt).valueOf()) / 3_600_000;

    const stats: DashboardStats = {
      totals: {
        issues: issues.length,
        open: open.length,
        resolved: resolved.length,
        reports: reportCount,
        // The number that makes the product's central claim measurable: how
        // many reports collapsed into a problem that already existed, rather
        // than opening one of their own.
        duplicatesMerged: Math.max(0, reportCount - issues.length),
        citizens,
      },
      resolutionRate: issues.length === 0 ? 0 : resolved.length / issues.length,
      medianResolutionHours: median(resolved.map(hoursFor)),

      byCategory: CATEGORIES.map((category) => ({
        category: category as Category,
        open: open.filter((i) => i.category === category).length,
        resolved: resolved.filter((i) => i.category === category).length,
      })).filter((row) => row.open + row.resolved > 0),

      byStatus: STATUSES.map((status) => ({
        status: status as Status,
        count: issues.filter((i) => i.status === status).length,
      })).filter((row) => row.count > 0),

      trend: buildTrend(issues),

      wards: wards
        .map((w) => {
          const mine = issues.filter((i) => String(i.wardId) === String(w._id));
          const mineResolved = mine.filter((i) => i.resolvedAt);
          return {
            ward: serializeWard(w)!,
            open: mine.filter((i) => !i.resolvedAt && i.status !== 'rejected').length,
            resolved: mineResolved.length,
            total: mine.length,
            resolutionRate: mine.length === 0 ? 0 : mineResolved.length / mine.length,
            medianResolutionHours: median(mineResolved.map(hoursFor)),
            slaBreaches: mine.filter((i) => i.slaDueAt && !i.resolvedAt && new Date(i.slaDueAt) < new Date()).length,
          };
        })
        .filter((row) => row.total > 0)
        .sort((a, b) => b.open - a.open),

      departments: DEPARTMENTS.map((department) => {
        const mine = issues.filter((i) => i.department === department);
        const mineResolved = mine.filter((i) => i.resolvedAt);
        return {
          department: department as Department,
          open: mine.filter((i) => !i.resolvedAt && i.status !== 'rejected').length,
          slaBreaches: mine.filter((i) => i.slaDueAt && !i.resolvedAt && new Date(i.slaDueAt) < new Date()).length,
          medianResolutionHours: median(mineResolved.map(hoursFor)),
        };
      }).filter((row) => row.open > 0 || row.medianResolutionHours !== null),
    };

    res.json(stats);
  }),
);

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : (sorted[mid] ?? 0);
  return Math.round(value * 10) / 10;
}

/** Last 30 days, oldest first, so the sparkline reads left to right. */
function buildTrend(issues: { createdAt?: Date | null; resolvedAt?: Date | null }[]): DashboardStats['trend'] {
  const days: DashboardStats['trend'] = [];
  const startOfDay = (d: Date) => {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy;
  };
  const today = startOfDay(new Date());

  for (let back = 29; back >= 0; back -= 1) {
    const day = new Date(today.valueOf() - back * 86_400_000);
    const next = new Date(day.valueOf() + 86_400_000);
    const inDay = (value?: Date | null) => value != null && new Date(value) >= day && new Date(value) < next;
    days.push({
      date: day.toISOString().slice(0, 10),
      reported: issues.filter((i) => inDay(i.createdAt)).length,
      resolved: issues.filter((i) => inDay(i.resolvedAt)).length,
    });
  }
  return days;
}

/** Wards, for the map's boundary overlay and the filter dropdown. */
statsRouter.get(
  '/wards',
  route(async (_req, res) => {
    const wards = await Ward.find({}).lean<(WardDoc & { _id: unknown })[]>();
    res.json({
      items: wards.map((w) => ({ ...serializeWard(w)!, boundary: w.boundary, center: w.center })),
    });
  }),
);
