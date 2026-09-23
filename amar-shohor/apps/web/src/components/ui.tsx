import { useEffect, type ReactNode } from 'react';
import { STATUS_META, type Photo, type PriorityResult, type Status, type Tone } from '@amar/shared';
import { Icon, type IconName } from './Icon';
import { useUi } from '../lib/ui-context';

/* --- card ---------------------------------------------------------------- */

export function Card({
  title,
  meta,
  action,
  tint,
  children,
  footer,
  tight,
}: {
  title?: ReactNode;
  /**
   * A short qualifier for the heading — a step index, a date range, the
   * mechanism a panel belongs to. It sits beside the title, not stacked above
   * it: a label above a heading is a kicker, and a kicker makes the reader
   * take two passes to find out what the card is.
   */
  meta?: string;
  action?: ReactNode;
  tint?: 'ok' | 'wait' | 'bad' | 'accent';
  children: ReactNode;
  footer?: ReactNode;
  tight?: boolean;
}) {
  return (
    <section className={`card${tint ? ` tint-${tint}` : ''}`}>
      {(title || action || meta) && (
        <header className="card-head">
          {title && <h2>{title}</h2>}
          {(meta || action) && (
            <div className="row" style={{ gap: 'var(--s3)', flex: '0 0 auto' }}>
              {meta && <span className="card-meta">{meta}</span>}
              {action}
            </div>
          )}
        </header>
      )}
      <div className={`card-body${tight ? ' tight' : ''}`}>{children}</div>
      {footer && <footer className="card-foot">{footer}</footer>}
    </section>
  );
}

/* --- stat tile ----------------------------------------------------------- */

export function Stat({
  label,
  value,
  unit,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  tone?: 'good' | 'warn' | 'bad';
}) {
  return (
    <div className={`stat${tone ? ` ${tone}` : ''}`}>
      <span className="stat-k">{label}</span>
      <div className="stat-v">
        {value}
        {unit && <small> {unit}</small>}
      </div>
      {sub && <div className="stat-s">{sub}</div>}
    </div>
  );
}

/* --- pills --------------------------------------------------------------- */

const TONE_CLASS: Record<Tone, string> = {
  neutral: '',
  accent: 'accent',
  ok: 'ok',
  wait: 'wait',
  bad: 'bad',
};

export function Pill({
  children,
  tone = 'neutral',
  icon,
  large,
}: {
  children: ReactNode;
  tone?: Tone;
  icon?: IconName;
  large?: boolean;
}) {
  return (
    <span className={`pill ${TONE_CLASS[tone]}${large ? ' lg' : ''}`}>
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}

const STATUS_ICON: Record<Status, IconName> = {
  reported: 'flag',
  verified: 'shield',
  assigned: 'user',
  in_progress: 'clock',
  resolved: 'check',
  rejected: 'close',
};

export function StatusPill({ status, large }: { status: Status; large?: boolean }) {
  const { statusLabel } = useUi();
  return (
    <Pill tone={STATUS_META[status].tone} icon={STATUS_ICON[status]} large={large}>
      {statusLabel(status)}
    </Pill>
  );
}

export function BandTag({ band }: { band: PriorityResult['band'] }) {
  const { bandLabel } = useUi();
  return <span className={`band band-${band}`}>{bandLabel(band)}</span>;
}

/* --- meter and score ring ------------------------------------------------ */

export function Meter({ value, band }: { value: number; band?: PriorityResult['band'] }) {
  return (
    <div className={`meter${band ? ` ${band}` : ''}`} role="presentation">
      <i style={{ width: `${Math.max(2, Math.min(100, value * 100))}%` }} />
    </div>
  );
}

/** The ring itself is the number — a conic gradient sized by the score. */
export function ScoreRing({ score, band }: { score: number; band: PriorityResult['band'] }) {
  return (
    <div
      className="score-ring"
      style={{ ['--pct' as string]: String(score), ['--ring-color' as string]: `var(--band-${band})` }}
      aria-label={`Priority score ${score} out of 100`}
    >
      <span>{score}</span>
    </div>
  );
}

/* --- feedback ------------------------------------------------------------ */

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: IconName;
  title: string;
  children?: ReactNode;
  /**
   * The way out. An empty state that names a problem and offers no control is
   * a dead end; this sits below the prose in its own row rather than inside
   * the paragraph, which is both invalid markup and a button that wraps
   * through the sentence.
   */
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-ico">
        <Icon name={icon} size={22} />
      </div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

export function Skeleton({ height = 16, width = '100%', radius }: { height?: number | string; width?: number | string; radius?: number }) {
  return <div className="skel" style={{ height, width, borderRadius: radius }} />;
}

export function Banner({
  tone = 'neutral',
  icon,
  children,
}: {
  tone?: 'neutral' | 'ok' | 'wait' | 'bad' | 'accent';
  icon?: IconName;
  children: ReactNode;
}) {
  return (
    <div className={`banner${tone === 'neutral' ? '' : ` ${tone}`}`} role={tone === 'bad' ? 'alert' : undefined}>
      {icon && <Icon name={icon} size={16} />}
      <div>{children}</div>
    </div>
  );
}

/* --- segmented control --------------------------------------------------- */

export function Seg<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
  label?: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={option.value === value ? 'on' : undefined}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* --- sheet --------------------------------------------------------------- */

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // Prevents the page behind from scrolling under the sheet on mobile.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      className="scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <header className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

/* --- photos -------------------------------------------------------------- */

export function PhotoGrid({ photos, tag }: { photos: Photo[]; tag?: string }) {
  if (photos.length === 0) return null;
  return (
    <div className="photos">
      {photos.map((photo) => (
        <a key={photo.id} className="photo" href={photo.url} target="_blank" rel="noreferrer">
          <img src={photo.thumbUrl} alt="" loading="lazy" width={photo.width} height={photo.height} />
          {tag && <span className="photo-tag">{tag}</span>}
        </a>
      ))}
    </div>
  );
}

/* --- toast --------------------------------------------------------------- */

export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3600);
    return () => clearTimeout(timer);
  }, [onDone]);
  return (
    <div className="toast" role="status">
      {message}
    </div>
  );
}
