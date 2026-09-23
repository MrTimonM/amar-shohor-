import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CATEGORY_META, DEPARTMENT_LABELS, SEVERITY_LABELS, STATUS_META, BAND_LABELS } from '@amar/shared';
import type { Category, Department, Status } from '@amar/shared';

/**
 * Theme and language, together, because both are root-level attributes and
 * both need to survive a reload.
 *
 * Theme has three states, not two: 'system' stamps nothing on <html>, so
 * prefers-color-scheme decides. 'light' and 'dark' stamp data-theme, which
 * wins over the OS in both directions.
 */

export type ThemeChoice = 'light' | 'dark' | 'system';
export type Lang = 'bn' | 'en';

interface UiValue {
  theme: ThemeChoice;
  setTheme: (t: ThemeChoice) => void;
  /** What is actually on screen right now, after resolving 'system'. */
  resolved: 'light' | 'dark';
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Picks the Bengali or English string from any of the shared label maps. */
  t: (pair: { en: string; bn: string }) => string;
  categoryLabel: (c: Category) => string;
  statusLabel: (s: Status) => string;
  departmentLabel: (d: Department) => string;
  severityLabel: (n: number) => string;
  bandLabel: (b: 'critical' | 'high' | 'medium' | 'low') => string;
}

const UiContext = createContext<UiValue | null>(null);

const read = <T extends string>(key: string, fallback: T, allowed: readonly T[]): T => {
  try {
    const value = localStorage.getItem(key);
    return allowed.includes(value as T) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
};

const systemDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;

export function UiProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>(() => read('amar.theme', 'system', ['light', 'dark', 'system']));
  const [lang, setLangState] = useState<Lang>(() => read('amar.lang', 'bn', ['bn', 'en']));
  const [systemIsDark, setSystemIsDark] = useState(systemDark);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('amar.theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem('amar.lang', lang);
    } catch {
      /* ignore */
    }
  }, [lang]);

  const resolved: 'light' | 'dark' = theme === 'system' ? (systemIsDark ? 'dark' : 'light') : theme;

  const t = useCallback((pair: { en: string; bn: string }) => (lang === 'bn' ? pair.bn : pair.en), [lang]);

  const value = useMemo<UiValue>(
    () => ({
      theme,
      setTheme: setThemeState,
      resolved,
      lang,
      setLang: setLangState,
      t,
      categoryLabel: (c) => t(CATEGORY_META[c]),
      statusLabel: (s) => t(STATUS_META[s]),
      departmentLabel: (d) => t(DEPARTMENT_LABELS[d]),
      severityLabel: (n) => t(SEVERITY_LABELS[Math.min(5, Math.max(1, n))] ?? SEVERITY_LABELS[3]!),
      bandLabel: (b) => t(BAND_LABELS[b]),
    }),
    [theme, resolved, lang, t],
  );

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi(): UiValue {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi must be used inside UiProvider');
  return ctx;
}

/**
 * Interface copy. Small enough to keep in one object; phase 11 extracts it to
 * react-i18next with the same keys, which is why nothing here is inlined at a
 * call site.
 */
export const COPY = {
  appName: { en: 'Amar Shohor', bn: 'আমার শহর' },
  tagline: { en: 'One city, one map', bn: 'এক শহর, এক মানচিত্র' },

  navHome: { en: 'Home', bn: 'হোম' },
  navMap: { en: 'Map', bn: 'মানচিত্র' },
  navReport: { en: 'Report', bn: 'রিপোর্ট' },
  navMine: { en: 'My reports', bn: 'আমার রিপোর্ট' },
  navDashboard: { en: 'Dashboard', bn: 'ড্যাশবোর্ড' },
  navQueue: { en: 'Triage queue', bn: 'কাজের তালিকা' },
  navReview: { en: 'Merge review', bn: 'একত্রীকরণ যাচাই' },
  navAdmin: { en: 'Staff & access', bn: 'কর্মী ও প্রবেশাধিকার' },

  signIn: { en: 'Sign in', bn: 'সাইন ইন' },
  signOut: { en: 'Sign out', bn: 'সাইন আউট' },

  reportCta: { en: 'Report a problem', bn: 'সমস্যা জানান' },
  reportOne: { en: '1 report', bn: '১টি রিপোর্ট' },
  confirm: { en: 'Confirm', bn: 'নিশ্চিত করুন' },
  dispute: { en: 'Dispute', bn: 'আপত্তি' },

  priority: { en: 'Priority', bn: 'প্রাধান্য' },
  whyThisScore: { en: 'Why this score', bn: 'কেন এই স্কোর' },
  verification: { en: 'Community verification', bn: 'জনগণের যাচাই' },
  timeline: { en: 'What has happened', bn: 'যা যা হয়েছে' },
  reportsMerged: { en: 'Reports merged into this problem', bn: 'এই সমস্যায় যুক্ত রিপোর্ট' },
  proofOfFix: { en: 'Proof of fix', bn: 'সমাধানের প্রমাণ' },

  loading: { en: 'Loading…', bn: 'লোড হচ্ছে…' },
  offline: { en: 'Offline — saved on this device', bn: 'অফলাইন — এই ডিভাইসে সংরক্ষিত' },
} as const;
