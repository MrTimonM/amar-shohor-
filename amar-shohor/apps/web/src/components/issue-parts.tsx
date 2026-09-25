import { Link } from 'react-router-dom';
import { STATUS_META, type IssueSummary, type PriorityResult, type ReportSummary, type StatusEventView, type VerificationSummary } from '@amar/shared';
import { Icon } from './Icon';
import { BandTag, Meter, Pill, ScoreRing, StatusPill } from './ui';
import { COPY, useUi } from '../lib/ui-context';
import { absoluteTime, distance, num, relativeTime, slaText } from '../lib/format';

/**
 * The pieces that make the product's claims legible: why an issue is ranked
 * where it is, how many reports became one problem, what the community said,
 * and what has actually happened since.
 */

/* --- priority ------------------------------------------------------------ */

export function PriorityBreakdown({ priority }: { priority: PriorityResult }) {
  const { lang, t } = useUi();

  return (
    <div className="stack">
      <div className="row" style={{ gap: 14 }}>
        <ScoreRing score={priority.score} band={priority.band} />
        <div className="stack-tight grow">
          <BandTag band={priority.band} />
          <p className="small dim">
            {t({
              en: 'Every factor below is shown with the points it added, out of 100. Nothing is hidden.',
              bn: 'নিচের প্রতিটি বিষয় কত পয়েন্ট যোগ করেছে তা দেখানো হয়েছে, ১০০-এর মধ্যে। কিছুই লুকানো নেই।',
            })}
          </p>
        </div>
      </div>

      <div className="factors">
        {priority.factors.map((factor) => (
          <div className="factor" key={factor.key}>
            <div>
              <div className="factor-label">{factor.label}</div>
              <div className="factor-detail">{factor.detail}</div>
            </div>
            <Meter value={factor.value} band={priority.band} />
            <div className="factor-pts num">
              {num(Math.round(factor.points), lang)}
              <span className="of"> / {num(factor.weight, lang)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --- merge proof --------------------------------------------------------- */

/**
 * "3 reports → 1 problem". The single most important thing to show, because it
 * is the claim the whole product rests on, and a sentence does not prove it.
 */
export function MergeProof({ reports, issue }: { reports: ReportSummary[]; issue: IssueSummary }) {
  const { lang, t } = useUi();
  if (reports.length < 2) return null;

  const thumbs = reports.slice(0, 4);

  return (
    <div className="merge-proof">
      <div className="stack-tight">
        <span className="eyebrow">
          {t({ en: `${reports.length} separate reports`, bn: `${num(reports.length, 'bn')}টি আলাদা রিপোর্ট` })}
        </span>
        <div className="merge-stack">
          {thumbs.map((report) => (
            <div className="photo" key={report.id} title={report.ref}>
              {report.photos[0] && <img src={report.photos[0].thumbUrl} alt="" loading="lazy" />}
            </div>
          ))}
        </div>
      </div>

      <Icon name="arrow" size={22} className="merge-arrow" />

      <div className="stack-tight">
        <span className="eyebrow">{t({ en: 'one verified problem', bn: 'একটি যাচাইকৃত সমস্যা' })}</span>
        <div className="merge-result">
          <div className="photo">{issue.photos[0] && <img src={issue.photos[0].thumbUrl} alt="" />}</div>
          <div className="stack-tight" style={{ gap: 2 }}>
            <span className="ref">{issue.ref}</span>
            <BandTag band={issue.priority.band} />
          </div>
        </div>
      </div>

      <p className="tiny muted" style={{ flexBasis: '100%' }}>
        {t({
          en: 'Merged automatically by matching location, category, time and photo similarity. Every merge is reversible and logged.',
          bn: 'স্থান, ধরন, সময় ও ছবির সাদৃশ্য মিলিয়ে স্বয়ংক্রিয়ভাবে যুক্ত হয়েছে। প্রতিটি একত্রীকরণ ফিরিয়ে নেওয়া যায় এবং লিপিবদ্ধ থাকে।',
        })}
      </p>
    </div>
  );
}

/* --- verification -------------------------------------------------------- */

export function VerificationPanel({
  verification,
  onVote,
  busy,
  voted,
}: {
  verification: VerificationSummary;
  onVote?: (vote: 'confirm' | 'dispute') => void;
  busy?: boolean;
  voted?: 'confirm' | 'dispute';
}) {
  const { lang, t } = useUi();
  const total = verification.weightedConfirms + verification.weightedDisputes;
  const confirmShare = total === 0 ? 0 : (verification.weightedConfirms / total) * 100;
  const reached = verification.weightedConfirms >= verification.threshold;

  return (
    <div className="stack">
      <div className="spread">
        <div className="row" style={{ gap: 14 }}>
          <div>
            <div className="stat-v" style={{ fontSize: 21 }}>
              {num(verification.confirms, lang)}
            </div>
            <div className="tiny muted">{t({ en: 'confirmed', bn: 'নিশ্চিত' })}</div>
          </div>
          <div>
            <div className="stat-v" style={{ fontSize: 21 }}>
              {num(verification.disputes, lang)}
            </div>
            <div className="tiny muted">{t({ en: 'disputed', bn: 'আপত্তি' })}</div>
          </div>
        </div>
        {reached ? (
          <Pill tone="ok" icon="shield">
            {t({ en: 'Threshold reached', bn: 'সীমা অতিক্রম' })}
          </Pill>
        ) : (
          <Pill tone="wait" icon="clock">
            {t({
              en: `${verification.threshold - Math.round(verification.weightedConfirms)} more needed`,
              bn: `আরও ${num(Math.max(0, verification.threshold - Math.round(verification.weightedConfirms)), 'bn')} জন দরকার`,
            })}
          </Pill>
        )}
      </div>

      {total > 0 && (
        <div className="verify-bar">
          <i className="c" style={{ width: `${confirmShare}%` }} />
          <i className="d" style={{ width: `${100 - confirmShare}%` }} />
        </div>
      )}

      <p className="tiny muted">
        {t({
          en: `Votes are weighted by the voter's track record, and only devices within ${verification.distanceM !== undefined ? '400 m' : '400 m'} of the problem can vote. The threshold is ${verification.threshold} weighted confirmations.`,
          bn: `ভোট গণনায় ভোটদাতার অতীত রেকর্ড বিবেচিত হয়, এবং সমস্যার ৪০০ মিটারের মধ্যে থাকা ডিভাইসই ভোট দিতে পারে। সীমা ${num(verification.threshold, 'bn')}টি ওয়েটেড নিশ্চিতকরণ।`,
        })}
      </p>

      {onVote && !voted && (
        <div className="row">
          <button
            type="button"
            className="btn primary"
            disabled={busy || verification.eligible === false}
            onClick={() => onVote('confirm')}
          >
            <Icon name="check" size={16} />
            {t(COPY.confirm)}
          </button>
          <button type="button" className="btn" disabled={busy || verification.eligible === false} onClick={() => onVote('dispute')}>
            <Icon name="close" size={16} />
            {t(COPY.dispute)}
          </button>
        </div>
      )}

      {voted && (
        <Pill tone={voted === 'confirm' ? 'ok' : 'bad'} icon={voted === 'confirm' ? 'check' : 'close'}>
          {voted === 'confirm'
            ? t({ en: 'You confirmed this', bn: 'আপনি নিশ্চিত করেছেন' })
            : t({ en: 'You disputed this', bn: 'আপনি আপত্তি জানিয়েছেন' })}
        </Pill>
      )}

      {verification.eligible === false && verification.distanceM !== undefined && (
        <p className="tiny" style={{ color: 'var(--wait)' }}>
          {t({
            en: `You are ${distance(verification.distanceM, 'en')} away — too far to vote on this one.`,
            bn: `আপনি ${distance(verification.distanceM, 'bn')} দূরে — ভোট দেওয়ার জন্য অনেক দূর।`,
          })}
        </p>
      )}
    </div>
  );
}

/* --- timeline ------------------------------------------------------------ */

export function Timeline({ events }: { events: StatusEventView[] }) {
  const { lang, statusLabel } = useUi();

  return (
    <ol className="tl">
      {events.map((event) => (
        <li key={event.id}>
          <span className={`tl-dot ${STATUS_META[event.status].tone}`}>
            <Icon name={event.status === 'resolved' ? 'check' : event.status === 'rejected' ? 'close' : 'chevron'} size={13} />
          </span>
          <div className="grow">
            <div className="tl-title">
              {event.from && event.from !== event.status && <>{statusLabel(event.from)} → </>}
              {statusLabel(event.status)}
            </div>
            <div className="tl-meta">
              {event.actor.name} · <time dateTime={event.at}>{absoluteTime(event.at, lang)}</time>
            </div>
            {event.note && <p className="tl-note">{event.note}</p>}
            {event.proofPhotos && event.proofPhotos.length > 0 && (
              <div className="photos" style={{ marginTop: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))' }}>
                {event.proofPhotos.map((photo) => (
                  <a className="photo" key={photo.id} href={photo.url} target="_blank" rel="noreferrer">
                    <img src={photo.thumbUrl} alt="" loading="lazy" />
                    <span className="photo-tag">{lang === 'bn' ? 'প্রমাণ' : 'proof'}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* --- issue row ----------------------------------------------------------- */

export function IssueRow({
  issue,
  selected,
  onClick,
  href,
}: {
  issue: IssueSummary;
  selected?: boolean;
  onClick?: () => void;
  href?: string;
}) {
  const { lang, categoryLabel, t } = useUi();
  const sla = slaText(issue.slaDueAt, issue.status === 'resolved', lang);

  const body = (
    <>
      {issue.photos[0] ? (
        <img className="issue-thumb" src={issue.photos[0].thumbUrl} alt="" loading="lazy" />
      ) : (
        <div className="issue-thumb" />
      )}
      <div className="grow stack-tight" style={{ gap: 4 }}>
        <div className="spread" style={{ gap: 8 }}>
          <span className="issue-title truncate">{categoryLabel(issue.category)}</span>
          <BandTag band={issue.priority.band} />
        </div>
        <div className="issue-meta">
          <span className="ref">{issue.ref}</span>
          {issue.ward && <span>{lang === 'bn' ? issue.ward.nameBn : issue.ward.name}</span>}
          <span>{relativeTime(issue.createdAt, lang)}</span>
        </div>
        <div className="row row-wrap" style={{ gap: 6 }}>
          <StatusPill status={issue.status} />
          {issue.reportCount > 1 && (
            <Pill icon="merge">
              {t({
                en: `${issue.reportCount} reports`,
                bn: `${num(issue.reportCount, 'bn')}টি রিপোর্ট`,
              })}
            </Pill>
          )}
          {sla && (
            <Pill tone={sla.tone} icon="clock">
              {sla.text}
            </Pill>
          )}
        </div>
      </div>
    </>
  );

  if (href) {
    return (
      <Link className={`issue-row${selected ? ' on' : ''}`} to={href}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" className={`issue-row${selected ? ' on' : ''}`} onClick={onClick}>
      {body}
    </button>
  );
}
