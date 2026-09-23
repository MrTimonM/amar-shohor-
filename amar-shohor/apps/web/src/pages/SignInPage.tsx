import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { Department } from '@amar/shared';
import { Icon } from '../components/Icon';
import { Banner, Card, Seg } from '../components/ui';
import { ApiFailure, api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { COPY, useUi } from '../lib/ui-context';

/**
 * Sign-in and sign-up on one page.
 *
 * Two axes, and they are deliberately different controls. *Mode* (sign in vs
 * create an account) is a segmented control, because it is a thing you switch
 * between. *Entity* (citizen vs authority) only appears while creating an
 * account, because signing in does not need it — the account already knows
 * what it is, and asking would only be a way to get it wrong.
 */
export function SignInPage() {
  const { t, lang } = useUi();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [mode, setMode] = useState<'login' | 'signup'>(params.get('mode') === 'signup' ? 'signup' : 'login');
  const [entity, setEntity] = useState<'citizen' | 'authority'>(params.get('as') === 'authority' ? 'authority' : 'citizen');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [department, setDepartment] = useState<Department | ''>('');
  const [staffCode, setStaffCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  // Only needed by the authority branch, so it is not fetched until then.
  const staffInfo = useQuery({
    queryKey: ['departments'],
    queryFn: api.departments,
    enabled: mode === 'signup' && entity === 'authority',
    staleTime: 5 * 60_000,
  });

  const reset = () => {
    setError(null);
    setFields({});
  };

  useEffect(reset, [mode, entity]);

  const fail = (err: unknown) => {
    if (err instanceof ApiFailure) {
      setError(err.message);
      setFields(err.fields ?? {});
    } else setError(String(err));
  };

  /** Staff land in the queue they signed in to work; everyone else on the map. */
  const land = (role: string) => navigate(role === 'authority' || role === 'admin' ? '/queue' : '/map');

  const submit = useMutation({
    mutationFn: async () => {
      reset();
      if (mode === 'login') return api.login(email, password);
      return api.signup({
        name,
        email,
        password,
        ...(entity === 'authority' ? { department: department as Department, staffCode } : {}),
      });
    },
    onSuccess: (result) => {
      signIn(result.token, result.user);
      land(result.user.role);
    },
    onError: fail,
  });

  const looksLikeEmail = /.+@.+\..+/.test(email);
  const ready =
    looksLikeEmail &&
    password.length >= (mode === 'signup' ? 8 : 1) &&
    (mode === 'login' || name.trim().length >= 2) &&
    (mode === 'login' || entity === 'citizen' || (Boolean(department) && staffCode.trim().length > 0));

  const staffClosed = staffInfo.data && !staffInfo.data.staffSignupOpen;

  return (
    <div style={{ maxWidth: 460, margin: '0 auto' }}>
      <div className="page-head center">
        <h1>{mode === 'login' ? t(COPY.signIn) : t({ en: 'Create your account', bn: 'অ্যাকাউন্ট তৈরি করুন' })}</h1>
        <p style={{ margin: '0 auto' }}>
          {t({
            en: 'You only need an account to report or verify a problem. Reading the map never does.',
            bn: 'সমস্যা জানাতে বা যাচাই করতেই কেবল অ্যাকাউন্ট দরকার। মানচিত্র দেখতে কখনও নয়।',
          })}
        </p>
      </div>

      <Card>
        <div className="stack">
          <Seg
            value={mode}
            onChange={setMode}
            options={[
              { value: 'login', label: t(COPY.signIn) },
              { value: 'signup', label: t({ en: 'Sign up', bn: 'নিবন্ধন' }) },
            ]}
          />

          {mode === 'signup' && (
            <div className="field">
              <label>{t({ en: 'This account is for', bn: 'এই অ্যাকাউন্টটি যার জন্য' })}</label>
              <Seg
                value={entity}
                onChange={setEntity}
                options={[
                  { value: 'citizen', label: t({ en: 'A citizen', bn: 'একজন নাগরিক' }) },
                  { value: 'authority', label: t({ en: 'City authority', bn: 'সিটি কর্তৃপক্ষ' }) },
                ]}
              />
              <span className="hint">
                {entity === 'citizen'
                  ? t({
                      en: 'Report problems, confirm what neighbours report, and follow what happens next.',
                      bn: 'সমস্যা জানান, প্রতিবেশীদের জানানো সমস্যা নিশ্চিত করুন, এবং এরপর কী হয় দেখুন।',
                    })
                  : t({
                      en: 'Work the department triage queue. Your city issues the staff code — this is not self-service.',
                      bn: 'বিভাগের কাজের তালিকা পরিচালনা করুন। স্টাফ কোড আপনার সিটি কর্পোরেশন দেয় — এটি নিজে নেওয়া যায় না।',
                    })}
              </span>
            </div>
          )}

          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              submit.mutate();
            }}
          >
            {mode === 'signup' && (
              <div className="field">
                <label htmlFor="name">{t({ en: 'Your name', bn: 'আপনার নাম' })}</label>
                <input
                  id="name"
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  placeholder={t({ en: 'Shown on problems you report', bn: 'আপনার জানানো সমস্যায় দেখানো হবে' })}
                  aria-invalid={Boolean(fields.name)}
                  required
                  autoFocus
                />
                {fields.name && <span className="err">{fields.name}</span>}
              </div>
            )}

            <div className="field">
              <label htmlFor="email">{t({ en: 'Email address', bn: 'ইমেইল ঠিকানা' })}</label>
              <input
                id="email"
                className="input"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={Boolean(fields.email)}
                required
                autoFocus={mode === 'login'}
              />
              {fields.email && <span className="err">{fields.email}</span>}
            </div>

            <div className="field">
              <label htmlFor="password">{t({ en: 'Password', bn: 'পাসওয়ার্ড' })}</label>
              <div className="row" style={{ gap: 6 }}>
                <input
                  id="password"
                  className="input grow"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={Boolean(fields.password)}
                  required
                />
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? t({ en: 'Hide password', bn: 'পাসওয়ার্ড লুকান' }) : t({ en: 'Show password', bn: 'পাসওয়ার্ড দেখান' })}
                  title={showPassword ? t({ en: 'Hide password', bn: 'পাসওয়ার্ড লুকান' }) : t({ en: 'Show password', bn: 'পাসওয়ার্ড দেখান' })}
                >
                  <Icon name={showPassword ? 'close' : 'user'} size={16} />
                </button>
              </div>
              {fields.password ? (
                <span className="err">{fields.password}</span>
              ) : mode === 'signup' ? (
                <span className="hint">{t({ en: 'At least 8 characters.', bn: 'কমপক্ষে ৮ অক্ষর।' })}</span>
              ) : null}
            </div>

            {mode === 'signup' && entity === 'authority' && (
              <>
                <div className="field">
                  <label htmlFor="department">{t({ en: 'Department', bn: 'বিভাগ' })}</label>
                  <select
                    id="department"
                    className="select"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value as Department)}
                    aria-invalid={Boolean(fields.department)}
                    required
                  >
                    <option value="">{t({ en: 'Choose a department', bn: 'বিভাগ বেছে নিন' })}</option>
                    {(staffInfo.data?.departments ?? []).map((d) => (
                      <option key={d.key} value={d.key}>
                        {lang === 'bn' ? d.bn : d.en}
                      </option>
                    ))}
                  </select>
                  {fields.department && <span className="err">{fields.department}</span>}
                </div>

                <div className="field">
                  <label htmlFor="staffCode">{t({ en: 'Staff code', bn: 'স্টাফ কোড' })}</label>
                  <input
                    id="staffCode"
                    className="input mono"
                    value={staffCode}
                    onChange={(e) => setStaffCode(e.target.value)}
                    autoComplete="off"
                    aria-invalid={Boolean(fields.staffCode)}
                    required
                  />
                  <span className="hint">
                    {t({
                      en: 'Issued by the city, not by this site. It is what separates a staff account from a citizen one.',
                      bn: 'এটি সিটি কর্পোরেশন দেয়, এই সাইট নয়। এটিই স্টাফ ও নাগরিক অ্যাকাউন্টের পার্থক্য।',
                    })}
                  </span>
                </div>

                {staffClosed && (
                  <Banner tone="wait" icon="alert">
                    {t({
                      en: 'This server is not issuing authority accounts right now.',
                      bn: 'এই সার্ভারে এখন কর্তৃপক্ষের অ্যাকাউন্ট দেওয়া হচ্ছে না।',
                    })}
                  </Banner>
                )}
              </>
            )}

            {error && (
              <Banner tone="bad" icon="alert">
                {error}
              </Banner>
            )}

            <button type="submit" className="btn primary wide lg" disabled={submit.isPending || !ready}>
              {submit.isPending
                ? t(COPY.loading)
                : mode === 'login'
                  ? t(COPY.signIn)
                  : t({ en: 'Create account', bn: 'অ্যাকাউন্ট তৈরি করুন' })}
            </button>
          </form>
        </div>
      </Card>

      <p className="tiny muted center" style={{ marginTop: 14 }}>
        {mode === 'login' ? (
          <>
            {t({ en: 'No account yet?', bn: 'এখনও অ্যাকাউন্ট নেই?' })}{' '}
            <button type="button" className="btn link" onClick={() => setMode('signup')}>
              {t({ en: 'Create one', bn: 'তৈরি করুন' })}
            </button>
          </>
        ) : (
          <>
            {t({ en: 'Already have an account?', bn: 'আগে থেকেই অ্যাকাউন্ট আছে?' })}{' '}
            <button type="button" className="btn link" onClick={() => setMode('login')}>
              {t(COPY.signIn)}
            </button>
          </>
        )}
        {' · '}
        <Link to="/map">{t({ en: 'Just show me the map', bn: 'শুধু মানচিত্র দেখান' })}</Link>
      </p>
    </div>
  );
}
