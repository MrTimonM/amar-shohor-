import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Icon, type IconName } from './Icon';
import { Toast } from './ui';
import { COPY, useUi, type ThemeChoice } from '../lib/ui-context';
import { useAuth } from '../lib/auth-context';
import { watchConnection } from '../lib/offline';

/**
 * Two shapes, one shell. Desktop gets the sidebar an authority actually wants;
 * mobile gets bottom tabs and a thumb-reachable camera button, because a
 * citizen reports a pothole standing next to it.
 */

interface NavEntry {
  to: string;
  icon: IconName;
  label: { en: string; bn: string };
  end?: boolean;
}

const CITIZEN_NAV: NavEntry[] = [
  { to: '/', icon: 'pin', label: COPY.navHome, end: true },
  { to: '/map', icon: 'map', label: COPY.navMap },
  { to: '/report', icon: 'camera', label: COPY.navReport },
  { to: '/mine', icon: 'list', label: COPY.navMine },
  { to: '/dashboard', icon: 'chart', label: COPY.navDashboard },
  { to: '/history', icon: 'clock', label: { en: 'History', bn: 'ইতিহাস' } },
];

const STAFF_NAV: NavEntry[] = [
  { to: '/queue', icon: 'inbox', label: COPY.navQueue },
  { to: '/review', icon: 'merge', label: COPY.navReview },
];

/** Admin-only, so it is a separate list rather than a hidden entry. */
const ADMIN_NAV: NavEntry[] = [{ to: '/admin', icon: 'shield', label: COPY.navAdmin }];

export function AppShell({ children }: { children: ReactNode }) {
  const { t, lang, setLang, theme, setTheme } = useUi();
  const { user, isStaff, signOut } = useAuth();
  const location = useLocation();
  const [toast, setToast] = useState<string | null>(null);

  // Phase 05: anything queued while offline sends itself on reconnect, and the
  // citizen is told — silence would look like the report was lost.
  useEffect(
    () =>
      watchConnection((result) => {
        if (result.sent > 0) {
          setToast(
            lang === 'bn'
              ? `${result.sent}টি সংরক্ষিত রিপোর্ট পাঠানো হয়েছে`
              : `${result.sent} saved report${result.sent === 1 ? '' : 's'} sent`,
          );
        }
      }),
    [lang],
  );

  const nextTheme: Record<ThemeChoice, ThemeChoice> = { system: 'light', light: 'dark', dark: 'system' };
  const themeIcon: Record<ThemeChoice, IconName> = { system: 'auto', light: 'sun', dark: 'moon' };
  const themeLabel: Record<ThemeChoice, string> = {
    system: t({ en: 'Theme: follows your device', bn: 'থিম: ডিভাইস অনুযায়ী' }),
    light: t({ en: 'Theme: light', bn: 'থিম: হালকা' }),
    dark: t({ en: 'Theme: dark', bn: 'থিম: গাঢ়' }),
  };

  const onMap = location.pathname === '/map';

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <Icon name="pin" size={15} />
          </span>
          <span>
            <span className="brand-name">{t(COPY.appName)}</span>
            <span className="brand-sub">{t(COPY.tagline)}</span>
          </span>
        </Link>

        <span className="grow" />

        <button
          type="button"
          className="icon-btn"
          onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}
          title={lang === 'bn' ? 'Switch to English' : 'বাংলায় দেখুন'}
          aria-label={lang === 'bn' ? 'Switch to English' : 'Switch to Bengali'}
        >
          <span className="mono" style={{ fontSize: 11, fontWeight: 600 }}>
            {lang === 'bn' ? 'EN' : 'বাং'}
          </span>
        </button>

        <button type="button" className="icon-btn" onClick={() => setTheme(nextTheme[theme])} title={themeLabel[theme]} aria-label={themeLabel[theme]}>
          <Icon name={themeIcon[theme]} size={16} />
        </button>

        {user ? (
          <div className="row" style={{ gap: 6 }}>
            <span className="small dim nowrap" style={{ maxWidth: 150 }}>
              <span className="truncate" style={{ display: 'block' }}>
                {user.name}
              </span>
            </span>
            <button type="button" className="icon-btn" onClick={signOut} title={t(COPY.signOut)} aria-label={t(COPY.signOut)}>
              <Icon name="signout" size={16} />
            </button>
          </div>
        ) : (
          <Link to="/signin" className="btn sm primary">
            {t(COPY.signIn)}
          </Link>
        )}
      </header>

      <nav className="nav" aria-label={t({ en: 'Sections', bn: 'বিভাগ' })}>
        <div className="nav-label eyebrow">{t({ en: 'The city', bn: 'শহর' })}</div>
        {CITIZEN_NAV.map((entry) => (
          <NavLink key={entry.to} to={entry.to} end={entry.end} className={({ isActive }) => `nav-item${isActive ? ' on' : ''}`}>
            <Icon name={entry.icon} size={17} className="ico" />
            {t(entry.label)}
          </NavLink>
        ))}

        {isStaff && (
          <>
            <div className="nav-label eyebrow">{t({ en: 'Authority', bn: 'কর্তৃপক্ষ' })}</div>
            {[...STAFF_NAV, ...(user?.role === 'admin' ? ADMIN_NAV : [])].map((entry) => (
              <NavLink key={entry.to} to={entry.to} className={({ isActive }) => `nav-item${isActive ? ' on' : ''}`}>
                <Icon name={entry.icon} size={17} className="ico" />
                {t(entry.label)}
              </NavLink>
            ))}
          </>
        )}

        <div className="nav-label eyebrow">{t({ en: 'About', bn: 'সম্পর্কে' })}</div>
        <p className="tiny muted" style={{ padding: '0 10px' }}>
          {t({
            en: 'Every problem here was reported by someone who lives in this city. Reading needs no account.',
            bn: 'এখানকার প্রতিটি সমস্যা এই শহরের কোনো বাসিন্দা জানিয়েছেন। দেখতে কোনো অ্যাকাউন্ট লাগে না।',
          })}
        </p>
      </nav>

      <main className={`main${onMap ? ' flush' : ''}`}>{children}</main>

      {/* Mobile */}
      <nav className="tabs" aria-label={t({ en: 'Sections', bn: 'বিভাগ' })}>
        {/* Home is reachable from the brand mark, so the bottom bar spends its
            four slots on destinations instead. */}
        {(isStaff ? [CITIZEN_NAV[1]!, ...STAFF_NAV, CITIZEN_NAV[4]!] : CITIZEN_NAV.slice(1, 5)).map((entry) => (
          <NavLink key={entry.to} to={entry.to} end={entry.end} className={({ isActive }) => `tab${isActive ? ' on' : ''}`}>
            <Icon name={entry.icon} size={20} />
            {t(entry.label)}
          </NavLink>
        ))}
      </nav>

      {!location.pathname.startsWith('/report') && (
        <Link to="/report" className="fab" aria-label={t(COPY.reportCta)}>
          <Icon name="camera" size={24} />
        </Link>
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
