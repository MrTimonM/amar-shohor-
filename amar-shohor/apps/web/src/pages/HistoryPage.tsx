import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { STATUSES } from '@amar/shared';
import { Timeline } from '../components/issue-parts';
import { Banner, Card, EmptyState, Skeleton, StatusPill } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { absoluteTime, num } from '../lib/format';
import { useUi } from '../lib/ui-context';

export function HistoryPage() {
  const { user, isStaff } = useAuth();
  const { t, lang, statusLabel, categoryLabel } = useUi();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const history = useQuery({
    queryKey: ['history', user?.id, page, status],
    queryFn: () => api.history(page, status || undefined),
  });
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head" style={{ marginBottom: 0 }}>
        <h1>{t({ en: 'Report history', bn: 'রিপোর্টের ইতিহাস' })}</h1>
        <p>{isStaff
          ? t({ en: 'Review current and closed problems in your workspace, and every recorded status update.', bn: 'আপনার বিভাগের চলমান ও বন্ধ সমস্যাগুলো এবং প্রতিটি নথিভুক্ত অবস্থার পরিবর্তন দেখুন।' })
          : t({ en: 'Follow the problems you reported, including resolved reports. Open a history to see previous statuses and updates.', bn: 'সমাধান হওয়া সমস্যাসহ আপনার জানানো সমস্যাগুলোর অগ্রগতি দেখুন। আগের অবস্থা ও আপডেট দেখতে ইতিহাস খুলুন।' })}</p>
      </div>
      <div className="spread row-wrap" style={{ gap: 12 }}>
        <label className="row" style={{ gap: 10 }}>
          {t({ en: 'Current status', bn: 'বর্তমান অবস্থা' })}
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">{t({ en: 'All statuses', bn: 'সব অবস্থা' })}</option>
            {STATUSES.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
          </select>
        </label>
        <button className="btn sm" disabled={history.isFetching} onClick={() => void history.refetch()}>
          {t({ en: 'Refresh', bn: 'রিফ্রেশ' })}
        </button>
      </div>
      {history.isLoading && <Skeleton height={200} />}
      {history.isError && <Banner tone="bad" icon="alert">{t({ en: 'History could not be loaded. Use Refresh to try again.', bn: 'ইতিহাস লোড হয়নি। আবার চেষ্টা করতে রিফ্রেশ করুন।' })}</Banner>}
      {history.data && <>
        <p className="small muted" aria-live="polite">{t({ en: `${num(history.data.total, lang)} problems · Most recently updated first`, bn: `${num(history.data.total, lang)}টি সমস্যা · সর্বশেষ আপডেট আগে` })}</p>
        {history.data.items.length === 0 ? (
          <EmptyState icon="clock" title={t({ en: 'No reports to show', bn: 'দেখানোর মতো রিপোর্ট নেই' })}>
            {t({ en: 'Reports appear here once linked to a problem. Try another status, or check My reports for submissions awaiting review.', bn: 'সমস্যার সঙ্গে যুক্ত হলে রিপোর্ট এখানে দেখা যাবে। অন্য অবস্থা বেছে নিন অথবা যাচাইয়ের অপেক্ষায় থাকা রিপোর্ট দেখতে আমার রিপোর্টে যান।' })}
            <Link to="/mine">{t({ en: 'My reports', bn: 'আমার রিপোর্ট' })}</Link>
          </EmptyState>
        ) : <Card tight>
          {history.data.items.map((issue) => (
            <Link key={issue.id} to={`/history/${issue.id}`} className="issue-row">
              <div className="grow stack-tight" style={{ minWidth: 0 }}>
                <span className="issue-title">{categoryLabel(issue.category)}</span>
                <span className="ref">{issue.ref}</span>
                {issue.address && <span className="small dim">{issue.address}</span>}
                <span className="tiny muted">{t({ en: 'Updated', bn: 'আপডেট' })} {absoluteTime(issue.updatedAt, lang)}</span>
                <span className="row row-wrap" style={{ gap: 10 }}>
                  <StatusPill status={issue.status} />
                  <span className="small">{t({ en: 'View history', bn: 'ইতিহাস দেখুন' })} →</span>
                </span>
              </div>
            </Link>
          ))}
        </Card>}
        {history.data.total > history.data.limit && <nav className="row row-wrap" aria-label={t({ en: 'History pages', bn: 'ইতিহাসের পাতা' })} style={{ gap: 12 }}>
          <button className="btn sm" disabled={page === 1} onClick={() => setPage(page - 1)}>{t({ en: 'Previous', bn: 'আগের' })}</button>
          <span className="small">{num(page, lang)} / {num(Math.ceil(history.data.total / history.data.limit), lang)}</span>
          <button className="btn sm" disabled={page * history.data.limit >= history.data.total} onClick={() => setPage(page + 1)}>{t({ en: 'Next', bn: 'পরের' })}</button>
        </nav>}
      </>}
    </div>
  );
}

export function ReportHistoryPage() {
  const { id = '' } = useParams();
  const { t, categoryLabel } = useUi();
  const issue = useQuery({ queryKey: ['issue', id], queryFn: () => api.issue(id), enabled: Boolean(id) });
  return <div className="stack" style={{ gap: 18, maxWidth: 900 }}>
    <Link to="/history">← {t({ en: 'Report history', bn: 'রিপোর্টের ইতিহাস' })}</Link>
    <h1>{t({ en: 'Status history', bn: 'অবস্থার ইতিহাস' })}</h1>
    {issue.isLoading && <Skeleton height={240} />}
    {issue.isError && <EmptyState icon="alert" title={t({ en: 'History unavailable', bn: 'ইতিহাস পাওয়া যায়নি' })}>
      <button className="btn" onClick={() => void issue.refetch()}>{t({ en: 'Try again', bn: 'আবার চেষ্টা করুন' })}</button>
    </EmptyState>}
    {issue.data && <>
      <div className="stack-tight">
        <h2>{categoryLabel(issue.data.category)}</h2>
        <div className="row row-wrap" style={{ gap: 10 }}><span className="ref">{issue.data.ref}</span><StatusPill status={issue.data.status} /></div>
        <Link to={`/issue/${id}`}>{t({ en: 'Open problem details', bn: 'সমস্যার বিস্তারিত দেখুন' })} →</Link>
      </div>
      <Card title={t({ en: 'Recorded updates', bn: 'নথিভুক্ত আপডেট' })}>
        <p className="small muted" style={{ marginBottom: 18 }}>{t({ en: 'Oldest first. Each update keeps its date, author, note and any proof photos.', bn: 'পুরোনো আপডেট আগে। প্রতিটি আপডেটে তারিখ, লেখক, মন্তব্য এবং প্রমাণের ছবি সংরক্ষিত থাকে।' })}</p>
        {issue.data.timeline.length ? <Timeline events={issue.data.timeline} /> : <p>{t({ en: 'No status updates have been recorded yet.', bn: 'এখনও কোনো অবস্থার আপডেট নথিভুক্ত হয়নি।' })}</p>}
      </Card>
    </>}
  </div>;
}
