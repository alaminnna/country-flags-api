'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { SearchX, SlidersHorizontal } from 'lucide-react';
import { Country } from '../../lib/api';
import { getCountries, matchesQuery, regionCounts } from '../../lib/countries';
import { useIsMobile } from '../../lib/hooks';
import { EASE_EXPO, SPRING_LAYOUT, STAGGER } from '../../lib/motion';
import { FlagCard } from '../../components/flag-card';
import { Chip, EmptyState, ErrorState, SearchInput, SegmentedControl, Skeleton } from '../../components/ui';
import { Sheet } from '../../components/sheet';

type PreviewFormat = 'png' | 'webp' | 'svg';
type GridCols = 'auto' | number;

const COL_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
];

const parseCols = (v: string): GridCols => (v === 'auto' ? 'auto' : parseInt(v, 10) || 'auto');

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, delay: Math.min(i, 29) * STAGGER, ease: EASE_EXPO },
  }),
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.15 } },
};

const itemVariantsReduced = {
  hidden: { opacity: 0 },
  show: () => ({ opacity: 1, transition: { duration: 0.01 } }),
  exit: { opacity: 0, transition: { duration: 0.01 } },
};

/**
 * Explore — desktop: left filter rail (regions + counts, preview format)
 * + 5-col flag grid with FLIP layout animations. Mobile: sticky search,
 * horizontal region chips, compact 3-col grid.
 */
export default function Explore() {
  const [countries, setCountries] = useState<Country[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState('');
  const [region, setRegion] = useState('');
  const [preview, setPreview] = useState<PreviewFormat>('png');
  const [columns, setColumns] = useState<GridCols>('auto');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(48);
  const searchRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const reduce = useReducedMotion();

  const load = () => {
    setFailed(false);
    getCountries().then((list) => {
      if (list.length === 0) setFailed(true);
      else setCountries(list);
    });
  };

  useEffect(load, []);

  // restore grid prefs (effect-only: no SSR/hydration mismatch)
  useEffect(() => {
    try {
      const c = localStorage.getItem('explore-cols');
      if (c) setColumns(parseCols(c));
      const f = localStorage.getItem('explore-preview');
      if (f === 'png' || f === 'webp' || f === 'svg') setPreview(f);
    } catch {
      /* private mode */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('explore-cols', String(columns));
    } catch {
      /* ignore */
    }
  }, [columns]);
  useEffect(() => {
    try {
      localStorage.setItem('explore-preview', preview);
    } catch {
      /* ignore */
    }
  }, [preview]);

  // "/" focuses search (desktop keyboard-first)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchRef.current) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const regions = useMemo(() => (countries ? regionCounts(countries) : []), [countries]);

  const filtered = useMemo(() => {
    if (!countries) return [];
    const nq = q.trim().toLowerCase();
    return countries.filter((c) => (!region || c.meta?.continent === region) && matchesQuery(c, nq));
  }, [countries, q, region]);

  const nq = q.trim().toLowerCase();
  const hasFilters = nq.length > 0 || region !== '';
  const clearAll = () => {
    setQ('');
    setRegion('');
  };

  // Progressive rendering: 254 eager <img> at once thrashes the network and
  // makes the page scroll through blank shimmer. Render 48 first, then grow
  // on scroll. Reset whenever the filter changes.
  useEffect(() => {
    setVisibleCount(48);
  }, [q, region, preview, columns]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((v) => Math.min(v + 48, 254));
        }
      },
      { rootMargin: '800px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [filtered.length, countries === null, failed]);

  const visible = filtered.slice(0, visibleCount);
  // FLIP layout animations are lovely for <60 items but jank the scroll for
  // the full 254 grid — use plain divs for large lists.
  const useMotion = reduce ? false : filtered.length <= 60;

  return (
    <div className="page-shell pt-8 lg:pt-12">
      <div className="max-w-prose">
        <p className="mono mb-2 text-[0.72rem] font-bold uppercase tracking-[0.12em] text-primary">Browse</p>
        <h1 className="h2">Explore all 254 countries</h1>
      </div>

      {/* mobile sticky search + filter button (chips live in the sheet — saves ~60px) */}
      <div className="sticky top-[var(--m-topbar,56px)] z-40 -mx-4 bg-bg/90 px-4 py-1.5 backdrop-blur-md lg:hidden">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <SearchInput
              value={q}
              onChange={setQ}
              placeholder="Search 254 countries…"
              ariaLabel="Search countries"
              inputRef={searchRef}
            />
          </div>
          <span className="relative shrink-0">
            <button
              className="icon-btn border !border-border bg-surface shadow-card"
              onClick={() => setSheetOpen(true)}
              aria-label={`Filters${hasFilters ? ' (active)' : ''}`}
              aria-haspopup="dialog"
            >
              <SlidersHorizontal size={19} />
            </button>
            {hasFilters && (
              <span
                className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white dark:text-[#060d0a]"
                aria-hidden
              >
                {(region ? 1 : 0) + (nq ? 1 : 0)}
              </span>
            )}
          </span>
        </div>
      </div>
      <p className="small-scale mt-2 font-semibold text-soft lg:hidden" aria-live="polite">
        {countries === null ? 'Loading…' : `${filtered.length} result${filtered.length === 1 ? '' : 's'}`}
        {region ? ` · ${region}` : ''}
      </p>

      <div className="mt-4 lg:mt-8 lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-10">
        {/* desktop filter rail */}
        <aside className="hidden lg:block">
          <div className="sticky top-[88px] max-h-[calc(100vh-110px)] overflow-y-auto pr-1">
            <div className="mb-5">
              <SearchInput value={q} onChange={setQ} placeholder="Fuzzy search…" ariaLabel="Search countries" kbdHint="/" inputRef={searchRef} />
            </div>
            <p className="mono mb-2 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-soft">Region</p>
            <div className="flex flex-col gap-0.5" role="tablist" aria-label="Region filter">
              <button className={`rail-item ${region === '' ? 'is-active' : ''}`} role="tab" aria-selected={region === ''} onClick={() => setRegion('')}>
                All regions <span className="rail-count">{countries?.length ?? '…'}</span>
              </button>
              {regions.map((r) => (
                <button
                  key={r.region}
                  className={`rail-item ${region === r.region ? 'is-active' : ''}`}
                  role="tab"
                  aria-selected={region === r.region}
                  onClick={() => setRegion(region === r.region ? '' : r.region)}
                >
                  {r.region} <span className="rail-count">{r.count}</span>
                </button>
              ))}
            </div>
            <p className="mono mb-2 mt-6 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-soft">Preview format</p>
            <SegmentedControl
              ariaLabel="Grid preview format"
              value={preview}
              onChange={(v) => setPreview(v as PreviewFormat)}
              scrollable
              options={[
                { value: 'png', label: 'PNG' },
                { value: 'webp', label: 'WebP' },
                { value: 'svg', label: 'SVG' },
              ]}
            />
            <p className="mono mb-2 mt-6 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-soft">Flags per row</p>
            <SegmentedControl
              ariaLabel="Flags per grid row"
              value={String(columns)}
              onChange={(v) => setColumns(parseCols(v))}
              scrollable
              options={COL_OPTIONS}
            />
            <p className="small-scale mt-3 leading-relaxed text-soft">
              Auto follows the screen size. A fixed number overrides it — and is remembered next visit.
            </p>
          </div>
        </aside>

        {/* results */}
        <section aria-live="polite">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {/* count lives under the sticky bar on mobile — hide here to avoid showing it twice */}
            <p className="small-scale hidden font-semibold text-soft lg:block">
              {countries === null ? 'Loading…' : `${filtered.length} result${filtered.length === 1 ? '' : 's'}`}
            </p>
            {region && (
              <button onClick={() => setRegion('')} aria-label={`Clear region filter ${region}`}>
                <Chip variant="active">{region} ✕</Chip>
              </button>
            )}
            {nq && (
              <button onClick={() => setQ('')} aria-label="Clear search">
                <Chip variant="active">“{q.trim()}” ✕</Chip>
              </button>
            )}
            {hasFilters && (
              <button onClick={clearAll} className="small-scale font-semibold text-primary hover:underline">
                Clear all
              </button>
            )}
          </div>

          {failed ? (
            <ErrorState title="Couldn’t load countries." hint="The API didn’t respond. Check that the backend is running, then retry." onRetry={load} />
          ) : countries === null ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5" aria-hidden>
              {Array.from({ length: 15 }).map((_, i) => (
                <Skeleton key={i} height={isMobile ? 110 : 150} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<SearchX size={28} />}
              title="No matches."
              hint="Try a name, an ISO code like “bd”, or clear the region filter."
              action={
                <button onClick={clearAll} className="btn btn-secondary btn-sm">
                  Clear filters
                </button>
              }
            />
          ) : (
            <>
              {useMotion ? (
                <motion.div layout={!reduce} className={`grid gap-3 ${columns === 'auto' ? 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5' : ''}`} style={columns === 'auto' ? undefined : { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }} transition={SPRING_LAYOUT}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    {visible.map((c, i) => (
                      <motion.div
                        key={c.code}
                        layout={!reduce}
                        custom={i}
                        variants={reduce ? itemVariantsReduced : itemVariants}
                        initial="hidden"
                        animate="show"
                        exit="exit"
                        transition={SPRING_LAYOUT}
                      >
                        <FlagCard country={c} query={nq} format={preview} showRegion={region === ''} eager={i < 12} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              ) : (
                <div
                  className={`grid gap-3 ${columns === 'auto' ? 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5' : ''}`}
                  style={columns === 'auto' ? undefined : { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
                >
                  {visible.map((c, i) => (
                    <FlagCard key={c.code} country={c} query={nq} format={preview} showRegion={region === ''} eager={i < 12} />
                  ))}
                </div>
              )}
              {visibleCount < filtered.length && (
                <div ref={sentinelRef} className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5" aria-hidden>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} height={isMobile ? 110 : 150} />
                  ))}
                </div>
              )}
              {visibleCount < filtered.length && (
                <p className="small-scale mt-4 text-center text-soft">
                  Showing {visible.length} of {filtered.length} — scroll for more
                </p>
              )}
              <div ref={visibleCount >= filtered.length ? sentinelRef : undefined} aria-hidden />
            </>
          )}
          <p className="small-scale mt-6 hidden text-soft lg:block">
            Tip: press <span className="kbd">/</span> to search, <span className="kbd">⌘</span>
            <span className="kbd">K</span> for the command palette.
          </p>
        </section>
      </div>

      {/* filter sheet: regions + preview format */}
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Filters">
        <p className="field-label">Region</p>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Region filter">
          <button
            className={`chip-btn ${region === '' ? 'is-active' : ''}`}
            role="tab"
            aria-selected={region === ''}
            onClick={() => setRegion('')}
          >
            All · {countries?.length ?? '…'}
          </button>
          {regions.map((r) => (
            <button
              key={r.region}
              className={`chip-btn ${region === r.region ? 'is-active' : ''}`}
              role="tab"
              aria-selected={region === r.region}
              onClick={() => setRegion(region === r.region ? '' : r.region)}
            >
              {r.region} · {r.count}
            </button>
          ))}
        </div>
        <p className="field-label mb-2 mt-6">Preview format</p>
        <SegmentedControl
          ariaLabel="Grid preview format"
          value={preview}
          onChange={(v) => setPreview(v as PreviewFormat)}
          options={[
            { value: 'png', label: 'PNG' },
            { value: 'webp', label: 'WebP' },
            { value: 'svg', label: 'SVG' },
          ]}
        />
        <p className="field-label mb-2 mt-6">Flags per row</p>
        <SegmentedControl
          ariaLabel="Flags per grid row"
          value={String(columns)}
          onChange={(v) => setColumns(parseCols(v))}
          scrollable
          className="max-w-full"
          options={COL_OPTIONS}
        />
        <p className="small-scale mt-3 leading-relaxed text-soft">
          Auto follows the screen size. A fixed number overrides it — and is remembered next visit.
        </p>
        <div className="mt-6 flex gap-2">
          {hasFilters && (
            <button className="btn btn-ghost flex-1" onClick={clearAll}>
              Clear all
            </button>
          )}
          <button className="btn btn-primary flex-[2]" onClick={() => setSheetOpen(false)}>
            Show {filtered.length} result{filtered.length === 1 ? '' : 's'}
          </button>
        </div>
      </Sheet>
    </div>
  );
}
