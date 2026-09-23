import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { Banner, Card, EmptyState, Pill, Skeleton, StatusPill } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { relativeTime } from '../lib/format';
import { flushQueue, listQueued, type QueuedReport } from '../lib/offline';
import { COPY, useUi } from '../lib/ui-context';

/**
 * What a citizen gets back for reporting. Every row answers "what happened to
 * mine?" — including the reports still sitting unsent on this device, which
 * are shown rather than hidden.
 */
export function MyReportsPage() {
  const { t, lang, categoryLabel } = useUi();
  const { user } = useAuth();
  const [queued, setQueued] = useState<QueuedReport[]>([]);
  const [flushing, setFlushing] = useState(false);

  const mine = useQuery({ queryKey: ['my-reports'], queryFn: api.myReports });

  useEffect(() => {
    void listQueued().then(setQueued);
  }, []);

  const retry = async () => {
    setFlushing(true);
    await flushQueue();
    setQueued(await listQueued());
    await mine.refetch();
    setFlushing(false);
  };

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head" style={{ marginBottom: 0 }}>
        <h1>{t(COPY.navMine)}</h1>
        <p>
          {t({
            en: 'Everything you have reported, and where it got to. You are notified when any of these changes.',
            bn: 'আপনি যা যা জানিয়েছেন এবং সেগুলো কোথায় পৌঁছেছে। এগুলোর কিছু বদলালে আপনাকে জানানো হবে।',
          })}
        </p>
      </div>

      {user && (
        <div className="grid g4">
          <Card tight>
            <span className="stat-k">{t({ en: 'Reports filed', bn: 'রিপোর্ট করেছেন' })}</span>
            <div className="stat-v">{user.reportCount}</div>
          </Card>
          <Card tight>
            <span className="stat-k">{t({ en: 'Problems verified', bn: 'যাচাই করেছেন' })}</span>
            <div className="stat-v">{user.verifiedCount}</div>
          </Card>
          <Card tight>
            <span className="stat-k">{t({ en: 'Trust score', bn: 'বিশ্বাস স্কোর' })}</span>
            <div className="stat-v">
              {user.trust.toFixed(1)}
              <small> / 5</small>
            </div>
          </Card>
          <Card tight>
            <span className="stat-k">{t({ en: 'Unsent on this device', bn: 'এই ডিভাইসে অপাঠানো' })}</span>
            <div className={`stat-v${queued.length > 0 ? '' : ''}`} style={{ color: queued.length > 0 ? 'var(--wait)' : undefined }}>
              {queued.length}
            </div>
          </Card>
        </div>
      )}

      {queued.length > 0 && (
        <Card tint="wait" title={t({ en: 'Waiting to send', bn: 'পাঠানোর অপেক্ষায়' })} action={
          <button type="button" className="btn sm" onClick={retry} disabled={flushing}>
            <Icon name="refresh" size={15} />
            {flushing ? t(COPY.loading) : t({ en: 'Try now', bn: 'এখনই চেষ্টা করুন' })}
          </button>
        }>
          <div className="stack">
            <p className="small dim">
              {t({
                en: 'These were written without a connection and are stored on this device with their photos. They send themselves when you are back online.',
                bn: 'এগুলো ইন্টারনেট ছাড়া লেখা হয়েছে এবং ছবিসহ এই ডিভাইসে জমা আছে। সংযোগ ফিরলেই নিজে থেকে চলে যাবে।',
              })}
            </p>
            {queued.map((entry) => (
              <div className="row" key={entry.id} style={{ gap: 10 }}>
                <Icon name="clock" size={16} />
                <span className="grow small">{categoryLabel(entry.category as never)}</span>
                <span className="tiny muted">{relativeTime(new Date(entry.createdAt).toISOString(), lang)}</span>
                {entry.attempts > 0 && (
                  <Pill tone="bad">
                    {t({ en: `${entry.attempts} failed tries`, bn: `${entry.attempts} বার ব্যর্থ` })}
                  </Pill>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {mine.isLoading && (
        <div className="stack">
          <Skeleton height={72} />
          <Skeleton height={72} />
          <Skeleton height={72} />
        </div>
      )}

      {mine.isError && (
        <Banner tone="bad" icon="alert">
          {t({ en: 'Could not load your reports. Reload the page.', bn: 'আপনার রিপোর্ট লোড হয়নি। পাতা রিলোড করুন।' })}
        </Banner>
      )}

      {mine.data && mine.data.items.length === 0 && queued.length === 0 && (
        <EmptyState icon="camera" title={t({ en: 'You have not reported anything yet', bn: 'আপনি এখনও কিছু জানাননি' })}>
          {t({
            en: 'Next time you pass a pothole or a dead streetlight, it takes about a minute.',
            bn: 'পরেরবার কোনো গর্ত বা নষ্ট বাতি দেখলে জানিয়ে দিন — এক মিনিটের কাজ।',
          })}
        </EmptyState>
      )}

      {mine.data && mine.data.items.length > 0 && (
        <Card tight>
          {mine.data.items.map((report) => (
            <div key={report.id} className="issue-row" style={{ cursor: 'default' }}>
              {report.photos[0] ? <img className="issue-thumb" src={report.photos[0].thumbUrl} alt="" loading="lazy" /> : <div className="issue-thumb" />}
              <div className="grow stack-tight" style={{ gap: 4 }}>
                <span className="issue-title">{categoryLabel(report.category)}</span>
                <div className="issue-meta">
                  <span className="ref">{report.ref}</span>
                  <span>{relativeTime(report.createdAt, lang)}</span>
                </div>

                {report.issue ? (
                  <div className="row row-wrap" style={{ gap: 6 }}>
                    <StatusPill status={report.issue.status} />
                    {report.issue.reportCount > 1 && (
                      <Pill icon="merge">
                        {t({
                          en: `merged with ${report.issue.reportCount - 1} other${report.issue.reportCount === 2 ? '' : 's'}`,
                          bn: `আরও ${report.issue.reportCount - 1}টির সঙ্গে যুক্ত`,
                        })}
                      </Pill>
                    )}
                    <Link className="tiny" to={`/issue/${report.issue.id}`}>
                      {t({ en: 'Open the problem', bn: 'সমস্যাটি দেখুন' })} →
                    </Link>
                  </div>
                ) : report.mergeDecision === 'pending' ? (
                  <Pill tone="wait" icon="clock">
                    {t({ en: 'Being checked by a moderator', bn: 'মডারেটর যাচাই করছেন' })}
                  </Pill>
                ) : (
                  <Pill icon="refresh">{t({ en: 'Matching against existing problems', bn: 'বিদ্যমান সমস্যার সঙ্গে মেলানো হচ্ছে' })}</Pill>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
