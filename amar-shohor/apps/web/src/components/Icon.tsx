import type { Category } from '@amar/shared';

/**
 * One icon set, drawn to a single spec: 24px grid, 1.7 stroke, round caps,
 * currentColor. Line icons rather than glyphs or emoji, so they inherit text
 * colour and stay legible at 14px in both themes.
 */

export type IconName =
  // categories
  | 'road_damage'
  | 'waterlogging'
  | 'garbage'
  | 'streetlight'
  | 'traffic_signal'
  | 'sidewalk'
  | 'congestion'
  | 'environmental'
  // navigation and actions
  | 'map'
  | 'camera'
  | 'list'
  | 'chart'
  | 'inbox'
  | 'merge'
  | 'check'
  | 'close'
  | 'alert'
  | 'clock'
  | 'user'
  | 'sun'
  | 'moon'
  | 'auto'
  | 'chevron'
  | 'back'
  | 'plus'
  | 'pin'
  | 'locate'
  | 'search'
  | 'shield'
  | 'arrow'
  | 'globe'
  | 'refresh'
  | 'flag'
  | 'layers'
  | 'thumb'
  | 'signout';

const PATHS: Record<IconName, string> = {
  // --- categories -----------------------------------------------------------
  // A road surface with a broken hole in it.
  road_damage: 'M3 18h18M6 18l1.5-9M18 18l-1.5-9M8 6h8M10.5 14.5c.8-1.6 3-1.9 4-.4.9 1.4-.3 3-1.9 2.9-1.4 0-2.7-1.1-2.1-2.5Z',
  // Water level with ripples over a submerged kerb.
  waterlogging: 'M3 14c1.6-1.2 3.4-1.2 5 0s3.4 1.2 5 0 3.4-1.2 5 0M3 18c1.6-1.2 3.4-1.2 5 0s3.4 1.2 5 0 3.4-1.2 5 0M7 10V5m10 5V7M7 7h10',
  // An overflowing bin.
  garbage: 'M5 8h14l-1 12H6L5 8Zm3 0V5h8v3M9 12v4m3-4v4m3-4v4',
  // A street lamp with its light out.
  streetlight: 'M12 21V9m0 0a4 4 0 0 1 8 0m-8 0a4 4 0 0 0-8 0M8 21h8M4 9h.01M20 9h.01',
  // A signal head with one lamp lit.
  traffic_signal: 'M9 3h6v14a3 3 0 0 1-6 0V3Zm3 3.5v.01M12 10v.01M12 13.5v.01M9 7H6m12 0h-3M9 13H6m12 0h-3',
  // Paving slabs, one lifted.
  sidewalk: 'M3 7h18M3 12h18M3 17h18M9 7v10m6-10v10M12.5 11.5l3 1',
  // Cars nose to tail.
  congestion: 'M4 9h4l1 3H3l1-3Zm0 3v3m5-3v3M15 9h4l1 3h-6l1-3Zm0 3v3m5-3v3M4.5 15h4m6.5 0h4',
  // A leaf with a plume of smoke.
  environmental: 'M12 20c0-5 3-9 8-9-1 5-4 8-8 9Zm0 0c0-4-2-7-6-7 .7 4 3 6.5 6 7ZM12 20v1M6 4c1.5 1 1.5 2.5 0 3.5S4.5 10 6 11',

  // --- navigation -----------------------------------------------------------
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14',
  camera: 'M4 8h3l1.5-2h7L17 8h3v11H4V8Zm8 8.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  chart: 'M4 20V10m5 10V4m5 16v-7m5 7V8M3 20h18',
  inbox: 'M4 13V6h16v7M4 13l2.5 5h11L20 13M4 13h4l1 2h6l1-2h4',
  merge: 'M6 4v5c0 3 3 4 6 4h6m0 0-3-3m3 3-3 3M6 20v-5',
  check: 'M5 12.5 9.5 17 19 7',
  close: 'M6 6l12 12M18 6 6 18',
  alert: 'M12 4 2.5 20h19L12 4Zm0 5v6m0 3v.01',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13.5V12l3.5 2',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9c0-3.9 3.6-6 8-6s8 2.1 8 6',
  sun: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z',
  auto: 'M4 6h16v10H4V6Zm4 14h8m-4-4v4',
  chevron: 'M9 6l6 6-6 6',
  back: 'M15 6l-6 6 6 6',
  plus: 'M12 5v14M5 12h14',
  pin: 'M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  locate: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0-13v3m0 14v3M2 12h3m14 0h3',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm5-1.5L20 20',
  shield: 'M12 3 5 6v6c0 4.2 3 7.6 7 9 4-1.4 7-4.8 7-9V6l-7-3Zm-2.5 9L11 13.5 15 9.5',
  arrow: 'M5 12h14m0 0-5-5m5 5-5 5',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.5 2.4 3.8 5.4 3.8 9S14.5 18.6 12 21c-2.5-2.4-3.8-5.4-3.8-9S9.5 5.4 12 3Z',
  refresh: 'M20 12a8 8 0 1 1-2.6-5.9M20 4v4h-4',
  flag: 'M6 21V4m0 0 12 2.5L6 12',
  layers: 'M12 3 3 7.5l9 4.5 9-4.5L12 3ZM3 12.5 12 17l9-4.5M3 17l9 4.5 9-4.5',
  thumb: 'M7 21V10l4-7 1.5.8c.8.4 1.1 1.4.8 2.2L12 9h5.5a2 2 0 0 1 2 2.3l-1 6.4A2.5 2.5 0 0 1 16 20H7Zm0 0H4V10h3',
  signout: 'M15 4h4v16h-4M12 12H3m0 0 3.5-3.5M3 12l3.5 3.5',
};

interface Props {
  name: IconName;
  size?: number;
  className?: string;
  /** Decorative by default; pass a label when the icon is the only content. */
  label?: string;
}

export function Icon({ name, size = 18, className, label }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export const categoryIcon = (category: Category): IconName => category as IconName;

/** Raw markup, for Leaflet divIcons which cannot take React children. */
export function iconMarkup(name: IconName, size = 15): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${PATHS[name]}"/></svg>`;
}
