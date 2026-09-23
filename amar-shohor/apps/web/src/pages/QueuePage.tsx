import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { BandTag, Card, EmptyState, Pill, Seg, Skeleton, StatusPill } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { num, relativeTime, slaText } from '../lib/format';
import { useUi } from '../lib/ui-context';

/**
 * Phase 13 — the authority triage queue.
 *
 * Sorted by the priority score, scoped to the department and wards this
 * account owns, with the SLA clock in a column rather than buried in a detail
 * page. A dense table, because this is a work tool used all day.
 */
type View = 'all' | 'mine' | 'unassigned' | 'overdue';

export function QueuePage() {
  const { t, lang, categoryLabel, departmentLabel } = useUi();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<View>('all');

  const queue = useQuery({
    queryKey: ['queue', view],
    queryFn: () => api.queue(view === 'all' ? undefined : view),
  });

  const items = queue.data?.items ?? [];
  const counts = queue.data?.counts;

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head" style={{ marginBottom: 0 }}>
        <h1>{t({ en: 'Triage queue', bn: 'কাজের তালিকা' })}</h1>
        <p>
          {user?.department
            ? t({
                en: `${departmentLabel(user.department)} — worst problems first, by the same score the public sees.`,
                bn: `${departmentLabel(user.department)} — সবচেয়ে গুরুতর আগে, জনসাধারণ যে স্কোর দেখে সেটিই।`,
              })
            : t({
                en: 'Every department — worst problems first, by the same score the public sees.',
                bn: 'সব বিভাগ — সবচেয়ে গুরুতর আগে, জনসাধারণ যে স্কোর দেখে সেটিই।',
              })}
        </p>
      </div>

      <div className="spread row-wrap">
        <Seg<View>
          value={view}
          onChange={setView}
          label={t({ en: 'Filter', bn: 'ফিল্টার' })}
          options={[
            { value: 'all', label: t({ en: 'All open', bn: 'সব খোলা' }) },
            { value: 'mine', label: t({ en: 'Mine', bn: 'আমার' }) },
            { value: 'unassigned', label: t({ en: 'Unassigned', bn: 'দায়িত্বহীন' }) },
            { value: 'overdue', label: t({ en: 'Overdue', bn: 'দেরি' }) },
          ]}
        />
        {counts && (
          <div className="row row-wrap" style={{ gap: 8 }}>
            <Pill>{t({ en: `${counts.total} open`, bn: `${num(counts.total, 'bn')}টি খোলা` })}</Pill>
            <Pill tone="wait">{t({ en: `${counts.unassigned} unassigned`, bn: `${num(counts.unassigned, 'bn')}টি দায়িত্বহীন` })}</Pill>
            <Pill tone={counts.overdue > 0 ? 'bad' : 'ok'}>
              {t({ en: `${counts.overdue} overdue`, bn: `${num(counts.overdue, 'bn')}টি দেরি` })}
            </Pill>
          </div>
        )}
      </div>

      {queue.isLoading && (
        <div className="stack">
          <Skeleton height={44} />
          <Skeleton height={220} />
        </div>
      )}

      {!queue.isLoading && items.length === 0 && (
        <EmptyState icon="check" title={t({ en: 'Nothing in this view', bn: 'এই তালিকায় কিছু নেই' })}>
          {view === 'overdue'
            ? t({ en: 'No problem in your area is past its deadline. That is worth noting.', bn: 'আপনার এলাকার কোনো সমস্যা সময়সীমা পার করেনি। এটা উল্লেখযোগ্য।' })
            : t({ en: 'Try a different filter.', bn: 'অন্য ফিল্টার দেখুন।' })}
        </EmptyState>
      )}

      {items.length > 0 && (
        <Card tight>
          <div className="tbl-wrap" style={{ border: 0 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 62 }}>{t({ en: 'Score', bn: 'স্কোর' })}</th>
                  <th>{t({ en: 'Problem', bn: 'সমস্যা' })}</th>
                  <th>{t({ en: 'Ward', bn: 'ওয়ার্ড' })}</th>
                  <th style={{ textAlign: 'right' }}>{t({ en: 'Reports', bn: 'রিপোর্ট' })}</th>
                  <th>{t({ en: 'Status', bn: 'অবস্থা' })}</th>
                  <th>{t({ en: 'Deadline', bn: 'সময়সীমা' })}</th>
                  <th>{t({ en: 'Owner', bn: 'দায়িত্বে' })}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((issue) => {
                  const sla = slaText(issue.slaDueAt, issue.status === 'resolved', lang);
                  return (
                    <tr key={issue.id} className="click" onClick={() => navigate(`/issue/${issue.id}`)}>
                      <td>
                        <span className="mono num" style={{ fontSize: 15, fontWeight: 600, color: `var(--band-${issue.priority.band})` }}>
                          {issue.priority.score}
                        </span>
                      </td>
                      <td>
                        <div className="stack-tight" style={{ gap: 2 }}>
                          <strong style={{ fontWeight: 600 }}>{categoryLabel(issue.category)}</strong>
                          <span className="row" style={{ gap: 8 }}>
                            <span className="ref">{issue.ref}</span>
                            <BandTag band={issue.priority.band} />
                            <span className="tiny muted">{relativeTime(issue.createdAt, lang)}</span>
                          </span>
                        </div>
                      </td>
                      <td className="dim">{issue.ward ? (lang === 'bn' ? issue.ward.nameBn : issue.ward.name) : '—'}</td>
                      <td className="n">{num(issue.reportCount, lang)}</td>
                      <td>
                        <StatusPill status={issue.status} />
                      </td>
                      <td>
                        {sla ? (
                          <span className="row tiny" style={{ gap: 5, color: sla.tone === 'bad' ? 'var(--bad)' : sla.tone === 'wait' ? 'var(--wait)' : 'var(--ink-2)' }}>
                            <Icon name="clock" size={13} />
                            {sla.text}
                          </span>
                        ) : (
                          <span className="tiny muted">{t({ en: 'not assigned', bn: 'দায়িত্ব দেওয়া হয়নি' })}</span>
                        )}
                      </td>
                      <td className="dim small">{issue.assignee?.name ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
