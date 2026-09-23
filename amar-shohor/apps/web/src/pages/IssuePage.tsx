import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CATEGORY_META, STATUSES, STATUS_META, canTransition, type Status } from '@amar/shared';
import { Icon } from '../components/Icon';
import { MapCanvas } from '../components/MapCanvas';
import { MergeProof, PriorityBreakdown, Timeline, VerificationPanel } from '../components/issue-parts';
import { Banner, Card, EmptyState, PhotoGrid, Pill, Sheet, Skeleton, StatusPill, Toast } from '../components/ui';
import { ApiFailure, api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { absoluteTime, num, relativeTime, slaText } from '../lib/format';
import { COPY, useUi } from '../lib/ui-context';
import { useGeolocation } from '../lib/use-geo';

/**
 * One problem, end to end. This page is the answer to the pitch deck's
 * sharpest complaint — "citizens never know what happens after they report" —
 * so the timeline, the priority reasoning and the merge proof are all here in
 * public, not behind an authority login.
 */
export function IssuePage() {
  const { id = '' } = useParams();
  const { t, lang, categoryLabel, severityLabel, departmentLabel } = useUi();
  const { user, isStaff } = useAuth();
  const geo = useGeolocation();
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<string | null>(null);
  /** `null` = closed. A Status pre-selects that step when it opens. */
  const [statusSheet, setStatusSheet] = useState<Status | 'any' | null>(null);

  const issueQuery = useQuery({
    queryKey: ['issue', id, geo.fix?.lat, geo.fix?.lng],
    queryFn: () => api.issue(id, geo.fix ?? undefined),
    enabled: Boolean(id),
  });

  const vote = useMutation({
    mutationFn: (choice: 'confirm' | 'dispute') => {
      if (!geo.fix) throw new ApiFailure(400, 'no_fix', t({ en: 'Turn on location to verify a problem.', bn: 'যাচাই করতে লোকেশন চালু করুন।' }));
      return api.verifyIssue(id, choice, geo.fix);
    },
    onSuccess: (result) => {
      setToast(
        result.statusChanged
          ? t({ en: 'Thanks — this problem is now verified', bn: 'ধন্যবাদ — সমস্যাটি এখন যাচাইকৃত' })
          : t({ en: 'Thanks, your vote is counted', bn: 'ধন্যবাদ, আপনার মত গণনা হয়েছে' }),
      );
      void queryClient.invalidateQueries({ queryKey: ['issue', id] });
    },
    onError: (err) => setToast(err instanceof ApiFailure ? err.message : String(err)),
  });

  const signOff = useMutation({
    mutationFn: (accept: boolean) => api.signOff(id, accept),
    onSuccess: (result) => {
      setToast(
        result.reopened
          ? t({ en: 'Reopened — it goes back to the department', bn: 'আবার খোলা হয়েছে — বিভাগে ফেরত গেছে' })
          : t({ en: 'Thanks for confirming the fix', bn: 'সমাধান নিশ্চিত করার জন্য ধন্যবাদ' }),
      );
      void queryClient.invalidateQueries({ queryKey: ['issue', id] });
    },
    onError: (err) => setToast(err instanceof ApiFailure ? err.message : String(err)),
  });

  if (issueQuery.isLoading) {
    return (
      <div className="stack">
        <Skeleton height={30} width="46%" />
        <Skeleton height={210} />
        <div className="grid g2">
          <Skeleton height={180} />
          <Skeleton height={180} />
        </div>
      </div>
    );
  }

  if (issueQuery.isError || !issueQuery.data) {
    return (
      <EmptyState icon="search" title={t({ en: 'Problem not found', bn: 'সমস্যাটি পাওয়া যায়নি' })}>
        {t({ en: 'The reference may be wrong, or it was removed in review.', bn: 'রেফারেন্স ভুল হতে পারে, অথবা যাচাইয়ে বাতিল হয়েছে।' })}
      </EmptyState>
    );
  }

  const issue = issueQuery.data;
  const [lng, lat] = issue.location.coordinates;
  const sla = slaText(issue.slaDueAt, issue.status === 'resolved', lang);
  const meta = CATEGORY_META[issue.category];

  /**
   * Mirrors `assertOwns` on the API: an admin, the assignee, or the department
   * that owns the category. The server is still the authority on this — the
   * point here is not to offer a button whose only outcome is a 403.
   */
  const canAct =
    user?.role === 'admin' ||
    (Boolean(issue.assignee) && issue.assignee?.id === user?.id) ||
    (user?.role === 'authority' && user.department === meta.department);
  const iReported = issue.reports.some((report) => report.reporter?.id === user?.id);
  const canSignOff = issue.status === 'resolved' && iReported;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div>
        <Link to="/" className="row small dim" style={{ gap: 5, textDecoration: 'none', marginBottom: 10 }}>
          <Icon name="back" size={15} />
          {t({ en: 'Back to the map', bn: 'মানচিত্রে ফিরুন' })}
        </Link>

        <div className="spread row-wrap" style={{ alignItems: 'flex-start' }}>
          <div className="stack-tight">
            <h1>{categoryLabel(issue.category)}</h1>
            <div className="row row-wrap" style={{ gap: 8 }}>
              <span className="ref">{issue.ref}</span>
              <StatusPill status={issue.status} large />
              {issue.reportCount > 1 && (
                <Pill icon="merge" large>
                  {t({
                    en: `${issue.reportCount} reports merged`,
                    bn: `${num(issue.reportCount, 'bn')}টি রিপোর্ট একত্রিত`,
                  })}
                </Pill>
              )}
              {sla && (
                <Pill tone={sla.tone} icon="clock" large>
                  {sla.text}
                </Pill>
              )}
            </div>
          </div>

          {isStaff &&
            (canAct ? (
              <div className="row" style={{ gap: 'var(--s2)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {/* Closing a problem is the action this workspace exists for, so
                    it is named and primary rather than one option inside a
                    generic dropdown. It still opens the same sheet, because the
                    note is still required and a proof photo can still be attached. */}
                {canTransition(issue.status, 'resolved') && (
                  <button type="button" className="btn primary" onClick={() => setStatusSheet('resolved')}>
                    <Icon name="check" size={16} />
                    {t({ en: 'Mark as solved', bn: 'সমাধান হয়েছে বলে চিহ্নিত করুন' })}
                  </button>
                )}
                <button
                  type="button"
                  className={canTransition(issue.status, 'resolved') ? 'btn ghost' : 'btn primary'}
                  onClick={() => setStatusSheet('any')}
                >
                  <Icon name="chevron" size={16} />
                  {t({ en: 'Update status', bn: 'অবস্থা হালনাগাদ' })}
                </button>
              </div>
            ) : (
              <span className="tiny muted" style={{ maxWidth: 200, textAlign: 'right' }}>
                {t({
                  en: `Only the ${meta.department} department can change this.`,
                  bn: 'শুধু সংশ্লিষ্ট বিভাগই এটি পরিবর্তন করতে পারে।',
                })}
              </span>
            ))}
        </div>
      </div>

      {issue.reportCount > 1 && (
        <Card meta={t({ en: 'Deduplication', bn: 'একত্রীকরণ' })} title={t(COPY.reportsMerged)}>
          <MergeProof reports={issue.reports} issue={issue} />
        </Card>
      )}

      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="stack" style={{ gap: 16 }}>
          <Card title={t({ en: 'What was reported', bn: 'যা জানানো হয়েছে' })}>
            <div className="stack">
              {issue.description && <p>{issue.description}</p>}
              <PhotoGrid photos={issue.photos} />
              <dl className="kv">
                <dt>{t({ en: 'Severity', bn: 'তীব্রতা' })}</dt>
                <dd>
                  {severityLabel(issue.severity)} ({issue.severity}/5)
                </dd>
                <dt>{t({ en: 'Ward', bn: 'ওয়ার্ড' })}</dt>
                <dd>{issue.ward ? `${lang === 'bn' ? issue.ward.nameBn : issue.ward.name}, ${issue.ward.cityCorporation}` : '—'}</dd>
                <dt>{t({ en: 'Department', bn: 'বিভাগ' })}</dt>
                <dd>{departmentLabel(meta.department)}</dd>
                <dt>{t({ en: 'First reported', bn: 'প্রথম রিপোর্ট' })}</dt>
                <dd>{absoluteTime(issue.createdAt, lang)}</dd>
                {issue.assignee && (
                  <>
                    <dt>{t({ en: 'Assigned to', bn: 'দায়িত্বে' })}</dt>
                    <dd>{issue.assignee.name}</dd>
                  </>
                )}
              </dl>
            </div>
          </Card>

          <Card
            meta={t(COPY.priority)}
            title={t(COPY.whyThisScore)}
            action={<span className="tiny muted">{t({ en: 'out of 100', bn: '১০০-এর মধ্যে' })}</span>}
          >
            <PriorityBreakdown priority={issue.priority} />
          </Card>

          <Card title={t(COPY.verification)}>
            {geo.status === 'idle' && (
              <div className="stack">
                <p className="small dim">
                  {t({
                    en: 'Verification is limited to people who are actually near the problem, so it needs your location.',
                    bn: 'যাচাই কেবল সমস্যার কাছে থাকা মানুষই করতে পারেন, তাই আপনার লোকেশন দরকার।',
                  })}
                </p>
                <button type="button" className="btn sm" onClick={() => geo.locate()}>
                  <Icon name="locate" size={15} />
                  {t({ en: 'Use my location', bn: 'আমার লোকেশন ব্যবহার করুন' })}
                </button>
              </div>
            )}
            {geo.error && <Banner tone="wait" icon="alert">{geo.error}</Banner>}
            <VerificationPanel
              verification={issue.verification}
              voted={issue.verification.myVote}
              busy={vote.isPending}
              onVote={user && geo.fix ? (choice) => vote.mutate(choice) : undefined}
            />
            {!user && (
              <p className="tiny muted" style={{ marginTop: 10 }}>
                <Link to="/signin">{t(COPY.signIn)}</Link>{' '}
                {t({ en: 'to confirm or dispute this problem.', bn: 'করে এই সমস্যাটি নিশ্চিত বা আপত্তি জানান।' })}
              </p>
            )}
          </Card>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <Card title={t({ en: 'Where it is', bn: 'কোথায়' })} tight>
            <div style={{ height: 260, borderRadius: 8, overflow: 'hidden' }}>
              <MapCanvas issues={[issue]} selectedId={issue.id} onSelect={() => {}} focus={{ lat, lng, zoom: 16 }} />
            </div>
            {issue.address && <p className="tiny muted" style={{ marginTop: 8 }}>{issue.address}</p>}
          </Card>

          {issue.proofPhotos.length > 0 && (
            <Card tint="ok" title={t(COPY.proofOfFix)}>
              <PhotoGrid photos={issue.proofPhotos} tag={lang === 'bn' ? 'সমাধান' : 'after'} />
            </Card>
          )}

          {canSignOff && (
            <Card tint="accent" title={t({ en: 'Is it actually fixed?', bn: 'সত্যিই সমাধান হয়েছে?' })}>
              <div className="stack">
                <p className="small dim">
                  {t({
                    en: 'You reported this. Only your confirmation counts toward the resolution figures on the public dashboard.',
                    bn: 'আপনি এটি জানিয়েছিলেন। জনসাধারণের ড্যাশবোর্ডের হিসাবে কেবল আপনার নিশ্চিতকরণই গণনা হয়।',
                  })}
                </p>
                <div className="row">
                  <button type="button" className="btn primary" disabled={signOff.isPending} onClick={() => signOff.mutate(true)}>
                    <Icon name="check" size={16} />
                    {t({ en: 'Yes, it is fixed', bn: 'হ্যাঁ, ঠিক হয়েছে' })}
                  </button>
                  <button type="button" className="btn danger" disabled={signOff.isPending} onClick={() => signOff.mutate(false)}>
                    <Icon name="refresh" size={16} />
                    {t({ en: 'No, reopen it', bn: 'না, আবার খুলুন' })}
                  </button>
                </div>
              </div>
            </Card>
          )}

          <Card title={t(COPY.timeline)}>
            {issue.timeline.length === 0 ? (
              <p className="small muted">{t({ en: 'Nothing recorded yet.', bn: 'এখনও কিছু নথিভুক্ত হয়নি।' })}</p>
            ) : (
              <Timeline events={issue.timeline} />
            )}
          </Card>

          {issue.reports.length > 0 && (
            <Card title={t({ en: 'Individual reports', bn: 'আলাদা রিপোর্টগুলো' })} tight>
              <div className="stack-tight">
                {issue.reports.map((report) => (
                  <div key={report.id} className="row" style={{ gap: 10, padding: '8px 4px', borderBottom: '1px solid var(--line)' }}>
                    {report.photos[0] && <img className="issue-thumb" style={{ width: 44, height: 44 }} src={report.photos[0].thumbUrl} alt="" loading="lazy" />}
                    <div className="grow stack-tight" style={{ gap: 2 }}>
                      <div className="row" style={{ gap: 8 }}>
                        <span className="ref">{report.ref}</span>
                        <span className="tiny muted">{relativeTime(report.createdAt, lang)}</span>
                        {report.queuedOffline && <Pill icon="refresh">{t(COPY.offline)}</Pill>}
                      </div>
                      <span className="tiny muted">{report.reporter?.name ?? t({ en: 'A citizen', bn: 'একজন নাগরিক' })}</span>
                      {report.mergeConfidence !== undefined && report.mergeDecision !== 'new' && (
                        <span className="tiny mono muted">
                          {t({ en: 'merge confidence', bn: 'একত্রীকরণের নিশ্চয়তা' })} {(report.mergeConfidence * 100).toFixed(0)}%
                          {report.mergeDecision === 'reviewed' && ` · ${t({ en: 'checked by a person', bn: 'মানুষ যাচাই করেছে' })}`}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {issue.nearby.length > 0 && (
            <Card title={t({ en: 'Other problems nearby', bn: 'কাছাকাছি অন্য সমস্যা' })} tight>
              {issue.nearby.map((near) => (
                <Link key={near.id} to={`/issue/${near.id}`} className="issue-row">
                  {near.photos[0] ? <img className="issue-thumb" src={near.photos[0].thumbUrl} alt="" loading="lazy" /> : <div className="issue-thumb" />}
                  <div className="grow stack-tight" style={{ gap: 3 }}>
                    <span className="issue-title truncate">{categoryLabel(near.category)}</span>
                    <span className="ref">{near.ref}</span>
                    <StatusPill status={near.status} />
                  </div>
                </Link>
              ))}
            </Card>
          )}
        </div>
      </div>

      {statusSheet && (
        <StatusSheet
          issueId={id}
          from={issue.status}
          initialTo={statusSheet === 'any' ? undefined : statusSheet}
          onClose={() => setStatusSheet(null)}
          onDone={(message) => {
            setStatusSheet(null);
            setToast(message);
            void queryClient.invalidateQueries({ queryKey: ['issue', id] });
          }}
        />
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}

/**
 * Phase 13 — the status change, with the two rules the API also enforces:
 * every change carries a note, and closing needs a photo of the fix.
 */
function StatusSheet({
  issueId,
  from,
  initialTo,
  onClose,
  onDone,
}: {
  issueId: string;
  from: Status;
  /** Pre-selects a step when the sheet was opened by a named action. */
  initialTo?: Status;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const { t, statusLabel } = useUi();
  const legal = STATUSES.filter((s) => canTransition(from, s));

  /**
   * Default to the next step *forward*, not the first legal one. From
   * `assigned` the legal list starts at `verified`, so the old default
   * pre-selected a move backwards down the lifecycle — the one thing someone
   * opening this sheet almost never wants.
   */
  const forward = legal.filter((s) => STATUS_META[s].step > STATUS_META[from].step);
  const [to, setTo] = useState<Status | ''>(initialTo ?? forward[0] ?? legal[0] ?? '');
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      if (!to) throw new Error('Pick a status');
      let proofPhotoIds: string[] | undefined;
      if (to === 'resolved' && files.length > 0) {
        const { photos } = await api.uploadPhotos(files);
        proofPhotoIds = photos.map((p) => p.id);
      }
      return api.changeStatus(issueId, { to, note, proofPhotoIds });
    },
    onSuccess: () => onDone(t({ en: 'Status updated', bn: 'অবস্থা হালনাগাদ হয়েছে' })),
    onError: (err) => setError(err instanceof ApiFailure ? err.message : String((err as Error).message ?? err)),
  });

  return (
    <Sheet title={t({ en: 'Update status', bn: 'অবস্থা হালনাগাদ' })} onClose={onClose}>
      <div className="stack">
        {legal.length === 0 ? (
          <Banner tone="wait" icon="alert">
            {t({ en: 'This problem is closed and cannot move further.', bn: 'এই সমস্যাটি বন্ধ, আর এগোনো যাবে না।' })}
          </Banner>
        ) : (
          <>
            <div className="field">
              <label htmlFor="to">{t({ en: 'Move to', bn: 'পরিবর্তন করুন' })}</label>
              <select id="to" className="select" value={to} onChange={(e) => setTo(e.target.value as Status)}>
                {legal.map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status)}
                  </option>
                ))}
              </select>
              <span className="hint">
                {t({ en: `Currently ${statusLabel(from)}. Only legal next steps are listed.`, bn: `বর্তমানে ${statusLabel(from)}। কেবল বৈধ পরবর্তী ধাপ দেখানো হয়েছে।` })}
              </span>
            </div>

            <div className="field">
              <label htmlFor="note">{t({ en: 'What changed, and why', bn: 'কী বদলাল এবং কেন' })}</label>
              <textarea id="note" className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t({ en: 'Crew scheduled for Thursday, materials requisitioned.', bn: 'বৃহস্পতিবার কাজের দল যাবে, মালামাল চাওয়া হয়েছে।' })} />
              <span className="hint">{t({ en: 'This appears on the public timeline. A note is required.', bn: 'এটি জনসাধারণের টাইমলাইনে দেখা যাবে। নোট দেওয়া বাধ্যতামূলক।' })}</span>
            </div>

            {to === 'resolved' && (
              <div className="field">
                <label htmlFor="proof">
                  {t(COPY.proofOfFix)}{' '}
                  <span className="muted">({t({ en: 'optional', bn: 'ঐচ্ছিক' })})</span>
                </label>
                <input
                  id="proof"
                  className="input"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                />
                <span className="hint">
                  {t({
                    en: 'Optional, but it is what the reporter sees before they accept the fix.',
                    bn: 'ঐচ্ছিক, তবে সমাধান মেনে নেওয়ার আগে যিনি জানিয়েছিলেন তিনি এটিই দেখেন।',
                  })}
                </span>
              </div>
            )}

            {error && <Banner tone="bad" icon="alert">{error}</Banner>}

            <button type="button" className="btn primary wide" disabled={submit.isPending || note.trim().length < 3} onClick={() => submit.mutate()}>
              {submit.isPending ? t(COPY.loading) : t({ en: 'Save and publish', bn: 'সংরক্ষণ ও প্রকাশ' })}
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}
