import { useQuery } from '@tanstack/react-query';
import { CategoryBars, TrendChart } from '../components/Charts';
import { Icon } from '../components/Icon';
import { Card, EmptyState, Skeleton, Stat } from '../components/ui';
import { api } from '../lib/api';
import { duration, num, pct } from '../lib/format';
import { useUi } from '../lib/ui-context';

/**
 * Phase 14 — the public accountability dashboard.
 *
 * Deliberately public and deliberately unflattering where the numbers are
 * unflattering. Median resolution time rather than mean, because a handful of
 * stale issues would otherwise hide the typical case and make the figure
 * useless to a citizen.
 */
export function DashboardPage() {
  const { t, lang, departmentLabel } = useUi();
  const stats = useQuery({ queryKey: ['dashboard'], queryFn: api.dashboard, staleTime: 60_000 });

  if (stats.isLoading) {
    return (
      <div className="stack" style={{ gap: 18 }}>
        <DashboardHead />
        <div className="grid g4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton height={92} key={i} />
          ))}
        </div>
        <Skeleton height={240} />
      </div>
    );
  }

  /**
   * The error and empty states keep the page's own frame. A bare red strip on
   * an otherwise blank page reads as the whole app having broken, and it told
   * the reader to reload without giving them anything to press.
   */
  if (stats.isError || !stats.data) {
    return (
      <div className="stack" style={{ gap: 18 }}>
        <DashboardHead />
        <EmptyState
          icon="alert"
          title={t({ en: 'The figures did not load', bn: 'হিসাব লোড হয়নি' })}
          action={
            <button type="button" className="btn sm" onClick={() => stats.refetch()} disabled={stats.isFetching}>
              <Icon name="refresh" size={14} />
              {stats.isFetching ? t({ en: 'Trying…', bn: 'চেষ্টা চলছে…' }) : t({ en: 'Try again', bn: 'আবার চেষ্টা করুন' })}
            </button>
          }
        >
          {t({
            en: 'The server did not answer. Nothing is lost — the numbers are recomputed on every visit.',
            bn: 'সার্ভার সাড়া দেয়নি। কিছুই হারায়নি — প্রতিবার এই পাতা খুললেই হিসাব নতুন করে হয়।',
          })}
        </EmptyState>
      </div>
    );
  }

  const data = stats.data;

  if (data.totals.issues === 0) {
    return (
      <div className="stack" style={{ gap: 18 }}>
        <DashboardHead />
        <EmptyState icon="chart" title={t({ en: 'No data yet', bn: 'এখনও কোনো তথ্য নেই' })}>
          {t({
            en: 'Run the seed script, or file the first report, and this page fills in.',
            bn: 'সিড স্ক্রিপ্ট চালান, অথবা প্রথম রিপোর্টটি করুন — তখনই এই পাতা পূর্ণ হবে।',
          })}
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <DashboardHead />

      <div className="grid g4">
        <Stat
          label={t({ en: 'Open problems', bn: 'খোলা সমস্যা' })}
          value={num(data.totals.open, lang)}
          sub={t({ en: `${num(data.totals.issues, lang)} total ever reported`, bn: `মোট ${num(data.totals.issues, lang)}টি জানানো হয়েছে` })}
          tone={data.totals.open > data.totals.resolved ? 'warn' : undefined}
        />
        <Stat
          label={t({ en: 'Resolution rate', bn: 'সমাধানের হার' })}
          value={pct(data.resolutionRate, lang)}
          sub={t({ en: `${num(data.totals.resolved, lang)} resolved`, bn: `${num(data.totals.resolved, lang)}টি সমাধান হয়েছে` })}
          tone={data.resolutionRate >= 0.5 ? 'good' : data.resolutionRate >= 0.25 ? 'warn' : 'bad'}
        />
        <Stat
          label={t({ en: 'Typical time to fix', bn: 'সাধারণত সময় লাগে' })}
          value={duration(data.medianResolutionHours, lang)}
          sub={t({ en: 'median, not average', bn: 'মধ্যমা, গড় নয়' })}
        />
        <Stat
          label={t({ en: 'Duplicates collapsed', bn: 'একত্রিত ডুপ্লিকেট' })}
          value={num(data.totals.duplicatesMerged, lang)}
          sub={t({
            en: `${num(data.totals.reports, lang)} reports became ${num(data.totals.issues, lang)} problems`,
            bn: `${num(data.totals.reports, lang)}টি রিপোর্ট থেকে ${num(data.totals.issues, lang)}টি সমস্যা`,
          })}
        />
      </div>

      <Card
        meta={t({ en: 'Last 30 days', bn: 'গত ৩০ দিন' })}
        title={t({ en: 'Reported against resolved', bn: 'রিপোর্ট বনাম সমাধান' })}
      >
        <TrendChart data={data.trend} />
        <p className="tiny muted" style={{ marginTop: 12 }}>
          {t({
            en: 'When the reported line sits above the resolved line for weeks, the backlog is growing. That is the whole point of showing both on one axis.',
            bn: 'রিপোর্টের রেখা সপ্তাহজুড়ে সমাধানের রেখার উপরে থাকলে বোঝা যায় জমে থাকা কাজ বাড়ছে। একই অক্ষে দুটোই দেখানোর কারণ এটাই।',
          })}
        </p>
      </Card>

      <div className="grid g2" style={{ alignItems: 'start' }}>
        <Card title={t({ en: 'By kind of problem', bn: 'সমস্যার ধরন অনুযায়ী' })}>
          <CategoryBars rows={data.byCategory} />
        </Card>

        <Card title={t({ en: 'By department', bn: 'বিভাগ অনুযায়ী' })} tight>
          <div className="tbl-wrap" style={{ border: 0 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t({ en: 'Department', bn: 'বিভাগ' })}</th>
                  <th style={{ textAlign: 'right' }}>{t({ en: 'Open', bn: 'খোলা' })}</th>
                  <th style={{ textAlign: 'right' }}>{t({ en: 'Overdue', bn: 'দেরি' })}</th>
                  <th style={{ textAlign: 'right' }}>{t({ en: 'Typical fix', bn: 'সময়' })}</th>
                </tr>
              </thead>
              <tbody>
                {data.departments.map((row) => (
                  <tr key={row.department}>
                    <td>{departmentLabel(row.department)}</td>
                    <td className="n">{num(row.open, lang)}</td>
                    <td className="n" style={{ color: row.slaBreaches > 0 ? 'var(--bad)' : undefined }}>
                      {num(row.slaBreaches, lang)}
                    </td>
                    <td className="n">{duration(row.medianResolutionHours, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card
        meta={t({ en: 'The scoreboard', bn: 'স্কোরবোর্ড' })}
        title={t({ en: 'Ward by ward', bn: 'ওয়ার্ড অনুযায়ী' })}
        footer={t({
          en: 'Sorted by open problems. A low resolution rate here is not an accusation — it is usually a ward with more problems than budget.',
          bn: 'খোলা সমস্যার ভিত্তিতে সাজানো। কম সমাধানের হার মানেই দোষ নয় — সাধারণত সেই ওয়ার্ডে বাজেটের চেয়ে সমস্যা বেশি।',
        })}
        tight
      >
        <div className="tbl-wrap" style={{ border: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>{t({ en: 'Ward', bn: 'ওয়ার্ড' })}</th>
                <th>{t({ en: 'City corporation', bn: 'সিটি কর্পোরেশন' })}</th>
                <th style={{ textAlign: 'right' }}>{t({ en: 'Open', bn: 'খোলা' })}</th>
                <th style={{ textAlign: 'right' }}>{t({ en: 'Resolved', bn: 'সমাধান' })}</th>
                <th style={{ textAlign: 'right' }}>{t({ en: 'Rate', bn: 'হার' })}</th>
                <th style={{ textAlign: 'right' }}>{t({ en: 'Typical fix', bn: 'সময়' })}</th>
                <th style={{ textAlign: 'right' }}>{t({ en: 'Overdue', bn: 'দেরি' })}</th>
              </tr>
            </thead>
            <tbody>
              {data.wards.map((row) => (
                <tr key={row.ward.id}>
                  <td>{lang === 'bn' ? row.ward.nameBn : row.ward.name}</td>
                  <td className="dim">{row.ward.cityCorporation}</td>
                  <td className="n">{num(row.open, lang)}</td>
                  <td className="n">{num(row.resolved, lang)}</td>
                  <td className="n">{pct(row.resolutionRate, lang)}</td>
                  <td className="n">{duration(row.medianResolutionHours, lang)}</td>
                  <td className="n" style={{ color: row.slaBreaches > 0 ? 'var(--bad)' : undefined }}>
                    {num(row.slaBreaches, lang)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card tint="accent" title={t({ en: 'Not built yet: predictive hotspots', bn: 'এখনও তৈরি হয়নি: ঝুঁকিপূর্ণ এলাকার পূর্বাভাস' })}>
        <p className="small dim">
          {t({
            en: 'Phase 14 also forecasts where waterlogging and road damage will recur, from historical reports plus season and rainfall, so the city can act before the complaints arrive. It needs a full monsoon of data before a forecast would mean anything, so it is deliberately absent rather than faked.',
            bn: 'চতুর্দশ ধাপে ঐতিহাসিক রিপোর্ট, মৌসুম ও বৃষ্টিপাত মিলিয়ে পূর্বাভাস দেওয়া হবে কোথায় আবার জলাবদ্ধতা বা রাস্তা ভাঙবে, যাতে অভিযোগ আসার আগেই কাজ করা যায়। অর্থবহ পূর্বাভাসের জন্য অন্তত একটি পূর্ণ বর্ষার তথ্য দরকার, তাই এটি বানিয়ে দেখানো হয়নি।',
          })}
        </p>
      </Card>
    </div>
  );
}

/** The page's identity, kept on screen in every state including failure. */
function DashboardHead() {
  const { t } = useUi();
  return (
    <div className="page-head" style={{ marginBottom: 0 }}>
      <h1>{t({ en: 'How the city is doing', bn: 'শহর কেমন চলছে' })}</h1>
      <p>
        {t({
          en: 'Every figure on this page is public. Resolution counts only where the citizen who reported the problem confirmed the fix.',
          bn: 'এই পাতার প্রতিটি হিসাব সর্বজনীন। যে নাগরিক সমস্যাটি জানিয়েছিলেন তিনি সমাধান নিশ্চিত করলেই সেটি সমাধান হিসেবে গণনা হয়।',
        })}
      </p>
    </div>
  );
}
