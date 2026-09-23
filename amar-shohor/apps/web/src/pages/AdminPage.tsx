import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DEPARTMENT_LABELS, type Department } from '@amar/shared';
import { Icon } from '../components/Icon';
import { Banner, Card, EmptyState, Pill, Skeleton } from '../components/ui';
import { ApiFailure, api, type StaffCodeRow, type StaffRow } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { useUi } from '../lib/ui-context';

/**
 * The admin console — who holds authority access, and what invitations are
 * outstanding.
 *
 * Both lists lead with **withdraw**, not delete. Revoking a code stops it
 * working immediately but leaves the record of what was issued and by whom;
 * demoting an account keeps the person who authored a status event attached to
 * that event. Erasing is available where it is safe, and refused where it
 * would leave the public timeline pointing at nothing.
 */
export function AdminPage() {
  const { t, lang } = useUi();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [department, setDepartment] = useState<Department | ''>('');
  const [label, setLabel] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(14);
  const [maxUses, setMaxUses] = useState(5);

  const codes = useQuery({ queryKey: ['staff-codes'], queryFn: api.staffCodes });
  const staff = useQuery({ queryKey: ['staff'], queryFn: api.staff });

  const fail = (err: unknown) => setError(err instanceof ApiFailure ? err.message : String(err));
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['staff-codes'] });
    void qc.invalidateQueries({ queryKey: ['staff'] });
  };

  const issue = useMutation({
    mutationFn: () => {
      setError(null);
      return api.createStaffCode({
        department: department || undefined,
        label: label.trim() || undefined,
        expiresInDays,
        maxUses,
      });
    },
    onSuccess: () => {
      setLabel('');
      refresh();
    },
    onError: fail,
  });

  const removeCode = useMutation({
    mutationFn: ({ id, hard }: { id: string; hard: boolean }) => {
      setError(null);
      return api.removeStaffCode(id, hard);
    },
    onSuccess: refresh,
    onError: fail,
  });

  const removeStaff = useMutation({
    mutationFn: ({ id, hard }: { id: string; hard: boolean }) => {
      setError(null);
      return api.removeStaff(id, hard);
    },
    onSuccess: refresh,
    onError: fail,
  });

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      // Clipboard is blocked outside a secure context; the code is on screen
      // to be read anyway, so this is not worth an error.
    }
  };

  const deptLabel = (d: Department | null) =>
    d ? (lang === 'bn' ? DEPARTMENT_LABELS[d].bn : DEPARTMENT_LABELS[d].en) : t({ en: 'Any department', bn: 'যেকোনো বিভাগ' });

  return (
    <div className="stack" style={{ gap: 'var(--s5)' }}>
      <div className="page-head">
        <h1>{t({ en: 'Staff and access', bn: 'কর্মী ও প্রবেশাধিকার' })}</h1>
        <p>
          {t({
            en: 'Authority accounts can close a problem on the public record, so who holds one is listed here and can be withdrawn here.',
            bn: 'কর্তৃপক্ষের অ্যাকাউন্ট প্রকাশ্য রেকর্ডে সমস্যা বন্ধ করতে পারে, তাই কার কাছে সেটি আছে তা এখানে দেখা যায় এবং এখান থেকেই ফিরিয়ে নেওয়া যায়।',
          })}
        </p>
      </div>

      {error && (
        <Banner tone="bad" icon="alert">
          {error}
        </Banner>
      )}

      {/* --- issue a code --- */}
      <Card title={t({ en: 'Issue a staff code', bn: 'স্টাফ কোড তৈরি করুন' })}>
        <form
          className="admin-form"
          onSubmit={(e) => {
            e.preventDefault();
            issue.mutate();
          }}
        >
          <div className="field">
            <label htmlFor="dept">{t({ en: 'Department', bn: 'বিভাগ' })}</label>
            <select id="dept" className="select" value={department} onChange={(e) => setDepartment(e.target.value as Department)}>
              <option value="">{t({ en: 'Any — holder chooses', bn: 'যেকোনো — যিনি ব্যবহার করবেন তিনি বাছবেন' })}</option>
              {Object.keys(DEPARTMENT_LABELS).map((key) => (
                <option key={key} value={key}>
                  {deptLabel(key as Department)}
                </option>
              ))}
            </select>
            <span className="hint">
              {t({
                en: 'A code tied to a department pins the account to it.',
                bn: 'বিভাগ নির্দিষ্ট করা কোড অ্যাকাউন্টটিকে সেই বিভাগেই বেঁধে দেয়।',
              })}
            </span>
          </div>

          <div className="field">
            <label htmlFor="label">
              {t({ en: 'What it is for', bn: 'কী কাজে' })} <span className="muted">({t({ en: 'optional', bn: 'ঐচ্ছিক' })})</span>
            </label>
            <input
              id="label"
              className="input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t({ en: 'e.g. Ward 12 field team', bn: 'যেমন ১২ নং ওয়ার্ড দল' })}
              maxLength={80}
            />
          </div>

          <div className="field">
            <label htmlFor="days">{t({ en: 'Expires in (days)', bn: 'মেয়াদ (দিন)' })}</label>
            <input
              id="days"
              className="input"
              type="number"
              min={1}
              max={365}
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Number(e.target.value))}
            />
          </div>

          <div className="field">
            <label htmlFor="uses">{t({ en: 'Maximum accounts', bn: 'সর্বোচ্চ অ্যাকাউন্ট' })}</label>
            <input
              id="uses"
              className="input"
              type="number"
              min={1}
              max={500}
              value={maxUses}
              onChange={(e) => setMaxUses(Number(e.target.value))}
            />
          </div>

          <button type="submit" className="btn primary" disabled={issue.isPending}>
            <Icon name="plus" size={15} />
            {issue.isPending ? t({ en: 'Issuing…', bn: 'তৈরি হচ্ছে…' }) : t({ en: 'Issue code', bn: 'কোড তৈরি করুন' })}
          </button>
        </form>
      </Card>

      {/* --- codes --- */}
      <Card
        title={t({ en: 'Staff codes', bn: 'স্টাফ কোড' })}
        meta={codes.data ? `${codes.data.items.filter((c) => c.state === 'active').length} active` : undefined}
        tight
      >
        {codes.isLoading ? (
          <div className="stack" style={{ padding: 'var(--s4)' }}>
            <Skeleton height={34} />
            <Skeleton height={34} />
          </div>
        ) : !codes.data?.items.length ? (
          <EmptyState icon="shield" title={t({ en: 'No codes issued yet', bn: 'এখনও কোনো কোড তৈরি হয়নি' })}>
            {t({
              en: 'Issue one above, then hand it to the person who needs an authority account.',
              bn: 'উপরে একটি তৈরি করুন, তারপর যাঁর কর্তৃপক্ষ অ্যাকাউন্ট দরকার তাঁকে দিন।',
            })}
          </EmptyState>
        ) : (
          <div className="tbl-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t({ en: 'Code', bn: 'কোড' })}</th>
                  <th>{t({ en: 'Department', bn: 'বিভাগ' })}</th>
                  <th>{t({ en: 'Used', bn: 'ব্যবহার' })}</th>
                  <th>{t({ en: 'Expires', bn: 'মেয়াদ শেষ' })}</th>
                  <th>{t({ en: 'State', bn: 'অবস্থা' })}</th>
                  <th aria-label={t({ en: 'Actions', bn: 'পদক্ষেপ' })} />
                </tr>
              </thead>
              <tbody>
                {codes.data.items.map((row) => (
                  <CodeRow
                    key={row.id}
                    row={row}
                    deptLabel={deptLabel}
                    copied={copied === row.code}
                    onCopy={() => void copy(row.code)}
                    onRemove={(hard) => removeCode.mutate({ id: row.id, hard })}
                    busy={removeCode.isPending}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* --- people --- */}
      <Card
        title={t({ en: 'People with access', bn: 'যাঁদের প্রবেশাধিকার আছে' })}
        meta={staff.data ? String(staff.data.items.length) : undefined}
        tight
      >
        {staff.isLoading ? (
          <div className="stack" style={{ padding: 'var(--s4)' }}>
            <Skeleton height={34} />
            <Skeleton height={34} />
          </div>
        ) : (
          <div className="tbl-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t({ en: 'Name', bn: 'নাম' })}</th>
                  <th>{t({ en: 'Email', bn: 'ইমেইল' })}</th>
                  <th>{t({ en: 'Role', bn: 'ভূমিকা' })}</th>
                  <th>{t({ en: 'Department', bn: 'বিভাগ' })}</th>
                  <th className="n">{t({ en: 'Open', bn: 'চলমান' })}</th>
                  <th aria-label={t({ en: 'Actions', bn: 'পদক্ষেপ' })} />
                </tr>
              </thead>
              <tbody>
                {(staff.data?.items ?? []).map((row) => (
                  <StaffTableRow
                    key={row.id}
                    row={row}
                    isSelf={row.id === user?.id}
                    deptLabel={deptLabel}
                    onRemove={(hard) => removeStaff.mutate({ id: row.id, hard })}
                    busy={removeStaff.isPending}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function CodeRow({
  row,
  deptLabel,
  copied,
  onCopy,
  onRemove,
  busy,
}: {
  row: StaffCodeRow;
  deptLabel: (d: Department | null) => string;
  copied: boolean;
  onCopy: () => void;
  onRemove: (hard: boolean) => void;
  busy: boolean;
}) {
  const { t } = useUi();
  const live = row.state === 'active';

  const STATE: Record<StaffCodeRow['state'], { tone: 'ok' | 'bad' | 'neutral' | 'wait'; label: { en: string; bn: string } }> = {
    active: { tone: 'ok', label: { en: 'Active', bn: 'সচল' } },
    revoked: { tone: 'bad', label: { en: 'Withdrawn', bn: 'প্রত্যাহৃত' } },
    expired: { tone: 'neutral', label: { en: 'Expired', bn: 'মেয়াদোত্তীর্ণ' } },
    used_up: { tone: 'wait', label: { en: 'Used up', bn: 'শেষ' } },
  };

  return (
    <tr className={live ? undefined : 'dim-row'}>
      <td>
        <button type="button" className="code-chip" onClick={onCopy} title={t({ en: 'Copy', bn: 'কপি করুন' })}>
          <span className="mono">{row.code}</span>
          <Icon name={copied ? 'check' : 'layers'} size={13} />
        </button>
        {row.label && <div className="tiny muted">{row.label}</div>}
      </td>
      <td>{deptLabel(row.department)}</td>
      <td className="mono" style={{ fontSize: 13 }}>
        {row.useCount}
        {row.maxUses != null ? ` / ${row.maxUses}` : ''}
      </td>
      <td className="tiny muted">{row.expiresAt ? new Date(row.expiresAt).toLocaleDateString() : '—'}</td>
      <td>
        <Pill tone={STATE[row.state].tone}>{t(STATE[row.state].label)}</Pill>
      </td>
      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        {live && (
          <button type="button" className="btn ghost sm" disabled={busy} onClick={() => onRemove(false)}>
            {t({ en: 'Withdraw', bn: 'প্রত্যাহার' })}
          </button>
        )}
        {row.useCount === 0 && (
          <button
            type="button"
            className="btn ghost sm danger-text"
            disabled={busy}
            onClick={() => onRemove(true)}
            title={t({ en: 'Erase — only possible while unused', bn: 'মুছে ফেলুন — কেউ ব্যবহার না করলেই সম্ভব' })}
          >
            {t({ en: 'Delete', bn: 'মুছুন' })}
          </button>
        )}
      </td>
    </tr>
  );
}

function StaffTableRow({
  row,
  isSelf,
  deptLabel,
  onRemove,
  busy,
}: {
  row: StaffRow;
  isSelf: boolean;
  deptLabel: (d: Department | null) => string;
  onRemove: (hard: boolean) => void;
  busy: boolean;
}) {
  const { t } = useUi();
  const ROLE_TONE: Record<string, 'accent' | 'ok' | 'neutral'> = { admin: 'accent', authority: 'ok', verifier: 'neutral' };

  return (
    <tr>
      <td>
        {row.name}
        {isSelf && <span className="tiny muted"> · {t({ en: 'you', bn: 'আপনি' })}</span>}
      </td>
      <td className="tiny muted">{row.email}</td>
      <td>
        <Pill tone={ROLE_TONE[row.role] ?? 'neutral'}>{row.role}</Pill>
      </td>
      <td>{row.department ? deptLabel(row.department) : '—'}</td>
      <td className="n">{row.openAssigned}</td>
      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        {isSelf ? (
          <span className="tiny muted">{t({ en: 'Cannot remove yourself', bn: 'নিজেকে সরানো যায় না' })}</span>
        ) : (
          <>
            <button
              type="button"
              className="btn ghost sm"
              disabled={busy}
              onClick={() => onRemove(false)}
              title={t({ en: 'Keep the account, remove the access', bn: 'অ্যাকাউন্ট থাকবে, প্রবেশাধিকার যাবে' })}
            >
              {t({ en: 'Revoke access', bn: 'প্রবেশাধিকার সরান' })}
            </button>
            <button
              type="button"
              className="btn ghost sm danger-text"
              disabled={busy || row.openAssigned > 0}
              onClick={() => onRemove(true)}
              title={
                row.openAssigned > 0
                  ? t({ en: 'Reassign their open problems first', bn: 'আগে তাঁদের চলমান সমস্যাগুলো অন্যকে দিন' })
                  : t({ en: 'Delete the account', bn: 'অ্যাকাউন্ট মুছুন' })
              }
            >
              {t({ en: 'Delete', bn: 'মুছুন' })}
            </button>
          </>
        )}
      </td>
    </tr>
  );
}
