import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CATEGORIES, type Category } from '@amar/shared';
import { MapCanvas } from '../components/MapCanvas';
import { Icon } from '../components/Icon';
import { IssueRow } from '../components/issue-parts';
import { EmptyState, Seg, Skeleton } from '../components/ui';
import { api } from '../lib/api';
import { num } from '../lib/format';
import { useUi } from '../lib/ui-context';
import { useGeolocation } from '../lib/use-geo';

/**
 * Phase 07 — the map, and the product's front door.
 *
 * Filters live in the URL so a view can be shared or bookmarked, and the query
 * is bounded by the viewport: at Dhaka scale, asking for the whole city would
 * ship tens of thousands of documents to a phone.
 *
 * The list beside the map is not decoration — it is the accessible equivalent
 * of the map, and on a low-end device it is the faster way to browse.
 */

type SortKey = 'priority' | 'newest' | 'reports';

export function MapPage() {
  const { t, lang, categoryLabel } = useUi();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [bbox, setBbox] = useState<string | undefined>();
  const [selected, setSelected] = useState<string | undefined>();
  const [listOpen, setListOpen] = useState(false);
  const [showWards, setShowWards] = useState(false);
  const geo = useGeolocation();
  const filterRow = useRef<HTMLDivElement>(null);

  // The filter row fades at its right edge to show it scrolls. Once it is
  // scrolled to the end there is nothing left to hint at, so the fade is
  // dropped rather than dimming the final chip permanently.
  const syncFilterFade = useCallback(() => {
    const el = filterRow.current;
    if (!el) return;
    el.classList.toggle('at-end', el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }, []);

  useLayoutEffect(() => {
    syncFilterFade();
    window.addEventListener('resize', syncFilterFade);
    return () => window.removeEventListener('resize', syncFilterFade);
  }, [syncFilterFade]);

  const activeCategories = useMemo(() => {
    const raw = params.get('category');
    return raw ? raw.split(',').filter((c) => (CATEGORIES as readonly string[]).includes(c)) : [];
  }, [params]);

  const hideResolved = params.get('resolved') !== '1';
  const sort = (params.get('sort') as SortKey) ?? 'priority';

  const issuesQuery = useQuery({
    queryKey: ['issues', bbox, activeCategories.join(','), hideResolved, sort],
    queryFn: () =>
      api.issues({
        bbox,
        category: activeCategories.length > 0 ? activeCategories : undefined,
        status: hideResolved ? ['reported', 'verified', 'assigned', 'in_progress'] : undefined,
        sort,
        limit: 300,
      }),
    enabled: Boolean(bbox),
  });

  const wardsQuery = useQuery({ queryKey: ['wards'], queryFn: api.wards, enabled: showWards, staleTime: 3_600_000 });

  const issues = issuesQuery.data?.items ?? [];

  const toggleCategory = (category: Category) => {
    const next = activeCategories.includes(category)
      ? activeCategories.filter((c) => c !== category)
      : [...activeCategories, category];
    const updated = new URLSearchParams(params);
    if (next.length > 0) updated.set('category', next.join(','));
    else updated.delete('category');
    setParams(updated, { replace: true });
  };

  const setParam = (key: string, value: string | null) => {
    const updated = new URLSearchParams(params);
    if (value === null) updated.delete(key);
    else updated.set(key, value);
    setParams(updated, { replace: true });
  };

  return (
    <div className={`map-page${listOpen ? ' list-open' : ''}`}>
      <aside className="map-side">
        <div className="map-side-head stack-tight">
          <div className="spread">
            <div>
              <div className="eyebrow">{t({ en: 'In view', bn: 'দৃশ্যমান' })}</div>
              <div className="row" style={{ gap: 6 }}>
                <strong className="num" style={{ fontSize: 21, letterSpacing: '-0.02em' }}>
                  {issuesQuery.isLoading ? '—' : num(issues.length, lang)}
                </strong>
                <span className="small muted">
                  {t({ en: 'problems', bn: 'সমস্যা' })}
                  {issuesQuery.data && issuesQuery.data.total > issues.length && (
                    <> · {t({ en: `${issuesQuery.data.total} total`, bn: `মোট ${num(issuesQuery.data.total, 'bn')}` })}</>
                  )}
                </span>
              </div>
            </div>
            <Seg<SortKey>
              value={sort}
              onChange={(next) => setParam('sort', next)}
              label={t({ en: 'Sort', bn: 'সাজান' })}
              options={[
                { value: 'priority', label: t({ en: 'Worst', bn: 'গুরুতর' }) },
                { value: 'newest', label: t({ en: 'New', bn: 'নতুন' }) },
                { value: 'reports', label: t({ en: 'Most', bn: 'বেশি' }) },
              ]}
            />
          </div>

          <div className="chip-row">
            <button
              type="button"
              className={`chip${!hideResolved ? ' on' : ''}`}
              onClick={() => setParam('resolved', hideResolved ? '1' : null)}
            >
              <Icon name="check" size={13} />
              {t({ en: 'Include resolved', bn: 'সমাধান হওয়াসহ' })}
            </button>
            {activeCategories.length > 0 && (
              <button type="button" className="chip" onClick={() => setParam('category', null)}>
                <Icon name="close" size={13} />
                {t({ en: 'Clear filters', bn: 'ফিল্টার মুছুন' })}
              </button>
            )}
          </div>
        </div>

        <div className="map-side-list">
          {issuesQuery.isLoading && (
            <div className="stack" style={{ padding: 12 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <div className="row" key={i} style={{ gap: 12 }}>
                  <Skeleton width={64} height={64} radius={6} />
                  <div className="stack-tight grow">
                    <Skeleton height={14} width="70%" />
                    <Skeleton height={11} width="45%" />
                    <Skeleton height={18} width="55%" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {issuesQuery.isError && (
            <EmptyState
              icon="alert"
              title={t({ en: 'Could not load the map', bn: 'মানচিত্র লোড হয়নি' })}
              action={
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => issuesQuery.refetch()}
                  disabled={issuesQuery.isFetching}
                >
                  <Icon name="refresh" size={14} />
                  {issuesQuery.isFetching
                    ? t({ en: 'Trying…', bn: 'চেষ্টা চলছে…' })
                    : t({ en: 'Try again', bn: 'আবার চেষ্টা করুন' })}
                </button>
              }
            >
              {t({
                en: 'The server is not responding. The map below still works; the list will fill in once it answers.',
                bn: 'সার্ভার সাড়া দিচ্ছে না। নিচের মানচিত্র এখনও চলছে; সার্ভার সাড়া দিলেই তালিকা আসবে।',
              })}
            </EmptyState>
          )}

          {/* Only when the query actually succeeded and came back empty. Both
              blocks used to render together on a failure, so the rail claimed
              the map had broken and that the area was clean, at once. */}
          {!issuesQuery.isLoading && !issuesQuery.isError && issues.length === 0 && (
            <EmptyState icon="map" title={t({ en: 'Nothing reported here', bn: 'এখানে কিছু জানানো হয়নি' })}>
              {t({
                en: 'Pan the map, widen the filters, or be the first to report a problem in this area.',
                bn: 'মানচিত্র সরান, ফিল্টার বাড়ান, অথবা এই এলাকার প্রথম সমস্যাটি আপনি জানান।',
              })}
            </EmptyState>
          )}

          {issues.map((issue) => (
            <IssueRow
              key={issue.id}
              issue={issue}
              selected={issue.id === selected}
              onClick={() => {
                setSelected(issue.id);
                navigate(`/issue/${issue.id}`);
              }}
            />
          ))}
        </div>
      </aside>

      <div className="map-holder">
        <div
          className="map-filters"
          ref={filterRow}
          onScroll={syncFilterFade}
          role="group" aria-label={t({ en: 'Filter by category', bn: 'ধরন অনুযায়ী ফিল্টার' })}>
          {CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              className={`chip${activeCategories.includes(category) ? ' on' : ''}`}
              onClick={() => toggleCategory(category)}
              aria-pressed={activeCategories.includes(category)}
            >
              <Icon name={category} size={14} />
              {categoryLabel(category)}
            </button>
          ))}
        </div>

        <div className="map-controls">
          <button
            type="button"
            className="icon-btn"
            onClick={() => geo.locate()}
            title={t({ en: 'Find me', bn: 'আমাকে খুঁজুন' })}
            aria-label={t({ en: 'Find me', bn: 'আমাকে খুঁজুন' })}
          >
            <Icon name={geo.status === 'locating' ? 'refresh' : 'locate'} size={16} />
          </button>
          <button
            type="button"
            className={`icon-btn${showWards ? ' on' : ''}`}
            onClick={() => setShowWards((v) => !v)}
            title={t({ en: 'Ward boundaries', bn: 'ওয়ার্ড সীমানা' })}
            aria-label={t({ en: 'Ward boundaries', bn: 'ওয়ার্ড সীমানা' })}
            aria-pressed={showWards}
          >
            <Icon name="layers" size={16} />
          </button>
          <button
            type="button"
            className="icon-btn only-mobile"
            onClick={() => setListOpen((v) => !v)}
            title={t({ en: 'List view', bn: 'তালিকা' })}
            aria-label={t({ en: 'List view', bn: 'তালিকা' })}
          >
            <Icon name="list" size={16} />
          </button>
        </div>

        <MapCanvas
          issues={issues}
          selectedId={selected}
          onSelect={(id) => {
            setSelected(id);
            navigate(`/issue/${id}`);
          }}
          onBoundsChange={setBbox}
          wards={wardsQuery.data?.items}
          showWards={showWards}
          focus={geo.fix ? { lat: geo.fix.lat, lng: geo.fix.lng, zoom: 16 } : undefined}
        />

        <div className="map-legend" aria-hidden="true">
          <span className="eyebrow" style={{ fontSize: 9.5 }}>
            {t({ en: 'Priority', bn: 'প্রাধান্য' })}
          </span>
          {(['critical', 'high', 'medium', 'low'] as const).map((band) => (
            <span className="row" key={band}>
              <i style={{ background: `var(--band-${band})` }} />
              {t({
                en: band,
                bn: { critical: 'সংকটপূর্ণ', high: 'উচ্চ', medium: 'মধ্যম', low: 'নিম্ন' }[band],
              })}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
