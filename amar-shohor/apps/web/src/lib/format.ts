import type { Lang } from './ui-context';

/** Bengali numerals, because a Bengali-first interface that shows 1,2,3 is not. */
const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export const num = (value: number, lang: Lang): string => {
  const formatted = value.toLocaleString('en-US');
  if (lang !== 'bn') return formatted;
  return formatted.replace(/\d/g, (d) => BN_DIGITS[Number(d)] ?? d);
};

export function relativeTime(iso: string, lang: Lang): string {
  const then = new Date(iso).valueOf();
  const minutes = Math.round((Date.now() - then) / 60_000);

  if (lang === 'bn') {
    if (minutes < 1) return 'এইমাত্র';
    if (minutes < 60) return `${num(minutes, 'bn')} মিনিট আগে`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${num(hours, 'bn')} ঘণ্টা আগে`;
    const days = Math.round(hours / 24);
    if (days < 30) return `${num(days, 'bn')} দিন আগে`;
    return `${num(Math.round(days / 30), 'bn')} মাস আগে`;
  }

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return `${Math.round(days / 30)} mo ago`;
}

export function absoluteTime(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Durations in the unit a person would actually say. */
export function duration(hours: number | null, lang: Lang): string {
  if (hours == null) return lang === 'bn' ? 'তথ্য নেই' : 'no data';
  if (hours < 24) return lang === 'bn' ? `${num(Math.round(hours), 'bn')} ঘণ্টা` : `${Math.round(hours)} h`;
  const days = hours / 24;
  if (days < 14) return lang === 'bn' ? `${num(Math.round(days), 'bn')} দিন` : `${days.toFixed(days < 3 ? 1 : 0)} d`;
  const weeks = Math.round(days / 7);
  return lang === 'bn' ? `${num(weeks, 'bn')} সপ্তাহ` : `${weeks} wk`;
}

export const pct = (ratio: number, lang: Lang): string => `${num(Math.round(ratio * 100), lang)}%`;

/** How long until the SLA runs out, or how far past it we already are. */
export function slaText(dueAt: string | undefined, resolved: boolean, lang: Lang): { text: string; tone: 'ok' | 'wait' | 'bad' } | null {
  if (!dueAt || resolved) return null;
  const msLeft = new Date(dueAt).valueOf() - Date.now();
  const hoursLeft = msLeft / 3_600_000;

  if (hoursLeft < 0) {
    const over = duration(Math.abs(hoursLeft), lang);
    return { text: lang === 'bn' ? `${over} দেরি` : `${over} overdue`, tone: 'bad' };
  }
  const left = duration(hoursLeft, lang);
  return {
    text: lang === 'bn' ? `${left} বাকি` : `${left} left`,
    tone: hoursLeft < 24 ? 'wait' : 'ok',
  };
}

export const distance = (metres: number, lang: Lang): string =>
  metres < 1000
    ? `${num(Math.round(metres), lang)} ${lang === 'bn' ? 'মি' : 'm'}`
    : `${num(Math.round(metres / 100) / 10, lang)} ${lang === 'bn' ? 'কিমি' : 'km'}`;
