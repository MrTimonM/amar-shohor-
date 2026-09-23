import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { Banner, Card, EmptyState, Meter, Pill, Skeleton, Toast } from '../components/ui';
import { ApiFailure, api } from '../lib/api';
import { relativeTime } from '../lib/format';
import { COPY, useUi } from '../lib/ui-context';

/**
 * Phase 10 — the moderator console.
 *
 * Reports that scored between the review and auto-merge thresholds wait here.
 * Throughput on this queue decides whether the public map stays clean, so the
 * screen shows the reasoning that produced the hold — each match factor and
 * what it contributed — rather than just a percentage.
 */
export function ReviewPage() {
  const { t, lang, categoryLabel } = useUi();
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<string | null>(null);

  const review = useQuery({ queryKey: ['review'], queryFn: api.reviewQueue });

  const decide = useMutation({
    mutationFn: api.decideMerge,
    onSuccess: (result) => {
      setToast(
        result.action === 'merge'
          ? t({ en: 'Merged into the existing problem', bn: 'বিদ্যমান সমস্যার সঙ্গে যুক্ত হয়েছে' })
          : result.action === 'split'
            ? t({ en: 'Filed as its own problem', bn: 'আলাদা সমস্যা হিসেবে যুক্ত হয়েছে' })
            : t({ en: 'Rejected', bn: 'বাতিল হয়েছে' }),
      );
      void queryClient.invalidateQueries({ queryKey: ['review'] });
    },
    onError: (err) => setToast(err instanceof ApiFailure ? err.message : String(err)),
  });

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head" style={{ marginBottom: 0 }}>
        <h1>{t(COPY.navReview)}</h1>
        <p>
          {t({
            en: 'These reports scored close enough to an existing problem to be suspicious, but not close enough to merge automatically. A wrong merge hides a real problem, so a person decides.',
            bn: 'এই রিপোর্টগুলো বিদ্যমান কোনো সমস্যার সঙ্গে যথেষ্ট মিলেছে, তবে স্বয়ংক্রিয়ভাবে যুক্ত করার মতো নয়। ভুল একত্রীকরণ একটি প্রকৃত সমস্যা ঢেকে দেয়, তাই সিদ্ধান্ত নেন একজন মানুষ।',
          })}
        </p>
      </div>

      {review.isLoading && (
        <div className="stack">
          <Skeleton height={200} />
          <Skeleton height={200} />
        </div>
      )}

      {review.isError && (
        <Banner tone="bad" icon="alert">
          {t({ en: 'Could not load the review queue.', bn: 'যাচাই তালিকা লোড হয়নি।' })}
        </Banner>
      )}

      {review.data && review.data.items.length === 0 && (
        <EmptyState icon="check" title={t({ en: 'Queue is clear', bn: 'তালিকা খালি' })}>
          {t({
            en: 'Nothing is waiting on a human decision. Reports above the auto-merge threshold went through on their own.',
            bn: 'মানুষের সিদ্ধান্তের অপেক্ষায় কিছু নেই। স্বয়ংক্রিয় সীমার উপরের রিপোর্টগুলো নিজেই যুক্ত হয়ে গেছে।',
          })}
        </EmptyState>
      )}

      {review.data?.items.map(({ report, candidates, reason }) => {
        const best = candidates[0];
        return (
          <Card
            key={report.id}
            meta={report.ref}
            title={categoryLabel(report.category)}
            action={
              <span className="tiny muted">
                {relativeTime(report.createdAt, lang)}
                {report.mergeConfidence !== undefined && ` · ${(report.mergeConfidence * 100).toFixed(0)}% ${t({ en: 'match', bn: 'মিল' })}`}
              </span>
            }
            tint="wait"
          >
            <div className="stack">
              {reason && (
                <Banner tone="wait" icon="alert">
                  {reason}
                </Banner>
              )}

              <div className="grid g2" style={{ alignItems: 'start' }}>
                <div className="stack-tight">
                  <span className="eyebrow">{t({ en: 'The new report', bn: 'নতুন রিপোর্ট' })}</span>
                  {report.photos[0] && (
                    <div className="photo" style={{ maxWidth: 240 }}>
                      <img src={report.photos[0].thumbUrl} alt="" loading="lazy" />
                    </div>
                  )}
                  {report.description && <p className="small dim">{report.description}</p>}
                  <div className="row row-wrap" style={{ gap: 6 }}>
                    <Pill>
                      {t({ en: 'severity', bn: 'তীব্রতা' })} {report.severity}/5
                    </Pill>
                    {report.reporter && <Pill icon="user">{report.reporter.name}</Pill>}
                    {report.ai?.model && <Pill icon="shield">{report.ai.model}</Pill>}
                  </div>
                </div>

                <div className="stack-tight">
                  <span className="eyebrow">{t({ en: 'Closest existing problem', bn: 'সবচেয়ে কাছের বিদ্যমান সমস্যা' })}</span>
                  {best ? (
                    <>
                      <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                        {best.issue.photos[0] && (
                          <div className="photo" style={{ width: 110, flex: '0 0 auto' }}>
                            <img src={best.issue.photos[0].thumbUrl} alt="" loading="lazy" />
                          </div>
                        )}
                        <div className="stack-tight grow" style={{ gap: 3 }}>
                          <strong>{categoryLabel(best.issue.category)}</strong>
                          <span className="ref">{best.issue.ref}</span>
                          <span className="tiny muted">
                            {t({ en: `${best.issue.reportCount} report(s) so far`, bn: `এখন পর্যন্ত ${best.issue.reportCount}টি রিপোর্ট` })}
                          </span>
                        </div>
                      </div>

                      {/* Why the engine hesitated, factor by factor. */}
                      <div className="factors" style={{ marginTop: 6 }}>
                        {best.match.factors.map((factor) => (
                          <div className="factor" key={factor.key}>
                            <div>
                              <div className="factor-label" style={{ textTransform: 'capitalize' }}>
                                {factor.key}
                              </div>
                              <div className="factor-detail">{factor.detail}</div>
                            </div>
                            <Meter value={factor.value} />
                            <div className="factor-pts num">{(factor.value * 100).toFixed(0)}%</div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="small muted">{t({ en: 'No candidate nearby any more.', bn: 'কাছাকাছি আর কোনো প্রার্থী নেই।' })}</p>
                  )}
                </div>
              </div>

              <div className="row row-wrap">
                {best && (
                  <button
                    type="button"
                    className="btn primary"
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ reportId: report.id, action: 'merge', targetIssueId: best.issue.id })}
                  >
                    <Icon name="merge" size={16} />
                    {t({ en: 'Same problem — merge', bn: 'একই সমস্যা — যুক্ত করুন' })}
                  </button>
                )}
                <button
                  type="button"
                  className="btn"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ reportId: report.id, action: 'split' })}
                >
                  <Icon name="plus" size={16} />
                  {t({ en: 'Different — file separately', bn: 'ভিন্ন — আলাদা করুন' })}
                </button>
                <button
                  type="button"
                  className="btn danger"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ reportId: report.id, action: 'reject', note: 'Not a valid report' })}
                >
                  <Icon name="close" size={16} />
                  {t({ en: 'Reject', bn: 'বাতিল' })}
                </button>
              </div>
            </div>
          </Card>
        );
      })}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
