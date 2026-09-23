import { useMemo, useRef, useState } from 'react';
import type { DashboardStats } from '@amar/shared';
import { useUi } from '../lib/ui-context';
import { num } from '../lib/format';

/**
 * Two charts, both deliberate about what colour is doing.
 *
 * The trend carries two *identities* (problems reported, problems resolved),
 * so it uses a categorical pair — blue and orange, checked against the palette
 * validator for lightness, chroma, colour-vision separation and contrast in
 * both themes. A green/amber pair is the obvious choice and fails: deuteranopia
 * collapses it.
 *
 * The category chart carries *state* (open vs resolved), which is what the
 * reserved status colours are for, and they ship with a labelled legend rather
 * than relying on colour alone.
 */

/* --- trend --------------------------------------------------------------- */

interface Point {
  date: string;
  reported: number;
  resolved: number;
}

export function TrendChart({ data }: { data: Point[] }) {
  const { lang, t } = useUi();
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const W = 720;
  const H = 190;
  const PAD = { top: 14, right: 46, bottom: 24, left: 34 };

  const geometry = useMemo(() => {
    const max = Math.max(4, ...data.flatMap((d) => [d.reported, d.resolved]));
    // Round the ceiling up to something a person would put on an axis.
    const step = max <= 8 ? 2 : max <= 20 ? 5 : max <= 50 ? 10 : 20;
    const top = Math.ceil(max / step) * step;

    const x = (i: number) => PAD.left + (i / Math.max(1, data.length - 1)) * (W - PAD.left - PAD.right);
    const y = (v: number) => PAD.top + (1 - v / top) * (H - PAD.top - PAD.bottom);

    const line = (key: 'reported' | 'resolved') => data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(' ');
    const area = (key: 'reported' | 'resolved') =>
      `${line(key)} L${x(data.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;

    const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
    return { x, y, top, line, area, ticks };
  }, [data]);

  const last = data[data.length - 1];
  const active = hover !== null ? data[hover] : null;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const px = ratio * W;
    const inner = W - PAD.left - PAD.right;
    const index = Math.round(((px - PAD.left) / inner) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, index)));
  };

  return (
    <div className="stack">
      {/* Legend is always present for two series, so identity is never colour
          alone; the end labels below repeat it directly on the marks. */}
      <div className="row row-wrap" style={{ gap: 16 }}>
        <span className="row tiny" style={{ gap: 6 }}>
          <i style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--series-reported)' }} />
          {t({ en: 'Reported', bn: 'রিপোর্ট হয়েছে' })}
        </span>
        <span className="row tiny" style={{ gap: 6 }}>
          <i style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--series-resolved)' }} />
          {t({ en: 'Resolved', bn: 'সমাধান হয়েছে' })}
        </span>
        <span className="grow" />
        {active && (
          <span className="tiny mono num dim">
            {active.date} · {num(active.reported, lang)} / {num(active.resolved, lang)}
          </span>
        )}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="spark"
        style={{ height: 190 }}
        role="img"
        aria-label={t({
          en: 'Problems reported and resolved per day over the last 30 days',
          bn: 'গত ৩০ দিনে প্রতিদিন রিপোর্ট ও সমাধান হওয়া সমস্যা',
        })}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {/* Recessive grid: present enough to read a value, quiet enough to
            stay behind the data. */}
        {geometry.ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={W - PAD.right} y1={geometry.y(tick)} y2={geometry.y(tick)} stroke="var(--grid)" strokeWidth={1} />
            <text x={PAD.left - 8} y={geometry.y(tick) + 4} textAnchor="end" fontSize={10} fill="var(--ink-4)" fontFamily="var(--mono)">
              {tick}
            </text>
          </g>
        ))}

        <path d={geometry.area('reported')} fill="var(--series-reported)" opacity={0.1} />
        <path d={geometry.area('resolved')} fill="var(--series-resolved)" opacity={0.1} />
        <path d={geometry.line('reported')} fill="none" stroke="var(--series-reported)" strokeWidth={2} strokeLinejoin="round" />
        <path d={geometry.line('resolved')} fill="none" stroke="var(--series-resolved)" strokeWidth={2} strokeLinejoin="round" />

        {/* Emphasised endpoint — the value a reader actually wants. */}
        {last && (
          <>
            <circle cx={geometry.x(data.length - 1)} cy={geometry.y(last.reported)} r={4} fill="var(--series-reported)" stroke="var(--surface)" strokeWidth={2} />
            <circle cx={geometry.x(data.length - 1)} cy={geometry.y(last.resolved)} r={4} fill="var(--series-resolved)" stroke="var(--surface)" strokeWidth={2} />
            <text x={W - PAD.right + 7} y={geometry.y(last.reported) + 4} fontSize={11} fill="var(--ink-2)" fontFamily="var(--mono)">
              {last.reported}
            </text>
            <text x={W - PAD.right + 7} y={geometry.y(last.resolved) + 4} fontSize={11} fill="var(--ink-2)" fontFamily="var(--mono)">
              {last.resolved}
            </text>
          </>
        )}

        {hover !== null && data[hover] && (
          <g>
            <line x1={geometry.x(hover)} x2={geometry.x(hover)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--ink-4)" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={geometry.x(hover)} cy={geometry.y(data[hover]!.reported)} r={5} fill="var(--series-reported)" stroke="var(--surface)" strokeWidth={2} />
            <circle cx={geometry.x(hover)} cy={geometry.y(data[hover]!.resolved)} r={5} fill="var(--series-resolved)" stroke="var(--surface)" strokeWidth={2} />
          </g>
        )}

        {data.map((point, i) =>
          i % 7 === 0 ? (
            <text key={point.date} x={geometry.x(i)} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--ink-4)" fontFamily="var(--mono)">
              {point.date.slice(5)}
            </text>
          ) : null,
        )}
      </svg>

      {/* The same numbers as rows, for screen readers and for anyone who wants
          the figures rather than the shape. */}
      <details>
        <summary className="tiny muted" style={{ cursor: 'pointer' }}>
          {t({ en: 'Show these numbers as a table', bn: 'এই সংখ্যাগুলো তালিকায় দেখুন' })}
        </summary>
        <div className="tbl-wrap" style={{ marginTop: 10, maxHeight: 240, overflowY: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>{t({ en: 'Date', bn: 'তারিখ' })}</th>
                <th>{t({ en: 'Reported', bn: 'রিপোর্ট' })}</th>
                <th>{t({ en: 'Resolved', bn: 'সমাধান' })}</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((row) => (
                <tr key={row.date}>
                  <td className="mono">{row.date}</td>
                  <td className="n">{num(row.reported, lang)}</td>
                  <td className="n">{num(row.resolved, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/* --- category bars ------------------------------------------------------- */

export function CategoryBars({ rows }: { rows: DashboardStats['byCategory'] }) {
  const { lang, categoryLabel, t } = useUi();
  const max = Math.max(1, ...rows.map((r) => r.open + r.resolved));
  const sorted = [...rows].sort((a, b) => b.open + b.resolved - (a.open + a.resolved));

  return (
    <div className="stack">
      <div className="row row-wrap" style={{ gap: 16 }}>
        <span className="row tiny" style={{ gap: 6 }}>
          <i style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--wait)' }} />
          {t({ en: 'Still open', bn: 'এখনও খোলা' })}
        </span>
        <span className="row tiny" style={{ gap: 6 }}>
          <i style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--ok)' }} />
          {t({ en: 'Resolved', bn: 'সমাধান হয়েছে' })}
        </span>
      </div>

      <div className="bars">
        {sorted.map((row) => {
          const total = row.open + row.resolved;
          return (
            <div className="bar-row" key={row.category}>
              <span className="truncate" title={categoryLabel(row.category)}>
                {categoryLabel(row.category)}
              </span>
              <div className="bar-track">
                {/* 2px surface gap between the segments, so a stacked bar does
                    not read as one blended block. */}
                <i className="open" style={{ width: `${(row.open / max) * 100}%` }} />
                {row.open > 0 && row.resolved > 0 && <i style={{ width: 2, background: 'var(--surface)' }} />}
                <i className="done" style={{ width: `${(row.resolved / max) * 100}%` }} />
              </div>
              <span className="bar-val num">
                {num(row.open, lang)}
                <span style={{ color: 'var(--ink-4)' }}> / {num(total, lang)}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
