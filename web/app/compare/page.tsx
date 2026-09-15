'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, Plus, Search, X } from 'lucide-react';
import { Country, fetchJSON } from '../../lib/api';
import { getCountries, matchesQuery } from '../../lib/countries';
import { EASE_EXPO, SPRING_LAYOUT, STAGGER } from '../../lib/motion';
import { FlagImage } from '../../components/flag-image';
import { Card, Chip, EmptyState, Skeleton } from '../../components/ui';

const MAX_COMPARE = 4;
const KEYS = [
  'official_name',
  'capital',
  'continent',
  'population',
  'area',
  'currency',
  'calling_code',
  'tld',
  'member_of',
  'sovereign_state',
] as const;

function cellValue(c: Country, k: string): string {  const v = (c.meta as unknown as Record<string, unknown>)[k];
  if (v === undefined || v === null || String(v).trim() === '') return '—';
  return Array.isArray(v) ? (v as unknown[]).join(', ') : String(v);
}

/** columns animate in with stagger */
const colVariants = {
  hidden: { opacity: 0, y: 18 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, delay: Math.min(i, 3) * STAGGER * 2, ease: EASE_EXPO },
  }),
  exit: { opacity: 0, scale: 0.97, transition: { duration: 0.15 } },
};

const colVariantsReduced = {
  hidden: { opacity: 0 },
  show: () => ({ opacity: 1, transition: { duration: 0.01 } }),
  exit: { opacity: 0, transition: { duration: 0.01 } },
};

/** searchable add-country box with keyboard-navigable dropdown */
function AddCountry({ all, selected, onAdd }: { all: Country[]; selected: string[]; onAdd: (code: string) => void }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);

  const results = useMemo(() => {
    const nq = q.trim().toLowerCase();
    if (!nq) return [];
    return all.filter((c) => !selected.includes(c.code) && matchesQuery(c, nq)).slice(0, 6);
  }, [all, selected, q]);

  useEffect(() => setActive(0), [q]);
  const open = focused && q.trim().length > 0 && selected.length < MAX_COMPARE;

  const pick = (code: string) => {
    onAdd(code);
    setQ('');
  };

  return (
    <div
      className="relative min-w-[220px] flex-1"
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown' && results.length) {
          e.preventDefault();
          setActive((a) => (a + 1) % results.length);
        } else if (e.key === 'ArrowUp' && results.length) {
          e.preventDefault();
          setActive((a) => (a - 1 + results.length) % results.length);
        } else if (e.key === 'Enter' && results.length) {
          e.preventDefault();
          pick(results[Math.min(active, results.length - 1)].code);
        } else if (e.key === 'Escape') {
          setQ('');
        }
      }}
    >
      <div className="search-wrap">
        <span className="search-icon" aria-hidden>
          <Search size={17} />
        </span>
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-label="Add a country to compare"
          autoComplete="off"
          spellCheck={false}
          className="search-input h-[44px] !pl-10 text-[0.88rem]"
          placeholder={selected.length >= MAX_COMPARE ? 'Maximum 4 countries' : 'Add a country…'}
          disabled={selected.length >= MAX_COMPARE}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
        />
      </div>
      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.div
            role="listbox"
            aria-label="Matching countries"
            className="card absolute inset-x-0 top-[calc(100%+6px)] z-50 p-1.5"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: EASE_EXPO }}
          >
            {results.map((c, i) => (
              <button
                key={c.code}
                role="option"
                aria-selected={i === active}
                className={`flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left ${i === active ? 'bg-primary-subtle' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(c.code)}
              >
                <span className="palette-thumb" aria-hidden>
                  <img src={`/assets/v1/images/w80/${c.code}.png`} alt="" loading="lazy" decoding="async" />
                </span>
                <span className="min-w-0 flex-1 truncate text-[0.87rem] font-medium">{c.name}</span>
                <Chip variant="iso">{c.code}</Chip>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Compare — 2–4 country selector with flag chips, staggered columns,
 * diff highlighting with dot markers, synced size slider (transform-only).
 */
export default function Compare() {
  const [all, setAll] = useState<Country[]>([]);
  const [selected, setSelected] = useState<string[]>(['bd', 'us']);
  const [data, setData] = useState<Record<string, Country | null>>({});
  const [flagScale, setFlagScale] = useState(1);
  const cache = useRef<Record<string, Country>>({});
  const reduce = useReducedMotion();

  useEffect(() => {
    getCountries().then(setAll);
  }, []);

  useEffect(() => {
    for (const code of selected) {
      if (data[code] !== undefined || cache.current[code]) {
        if (cache.current[code] && !data[code]) {
          setData((d) => ({ ...d, [code]: cache.current[code] }));
        }
        continue;
      }
      setData((d) => ({ ...d, [code]: null }));
      fetchJSON<Country>(`/api/v1/countries/${code}`)
        .then((c) => {
          cache.current[code] = c;
          setData((d) => ({ ...d, [code]: c }));
        })
        .catch(() => setData((d) => ({ ...d, [code]: null })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.join(',')]);

  const countries = useMemo(
    () => selected.map((code) => data[code] ?? cache.current[code] ?? null),
    [selected, data],
  );
  const ready = countries.every(Boolean);

  const add = (code: string) => {
    setSelected((s) => (s.includes(code) || s.length >= MAX_COMPARE ? s : [...s, code]));
  };
  const remove = (code: string) => setSelected((s) => s.filter((c) => c !== code));

  const gridCols =
    selected.length <= 2
      ? 'sm:grid-cols-2'
      : selected.length === 3
        ? 'sm:grid-cols-3'
        : 'sm:grid-cols-2 xl:grid-cols-4';

  return (
    <div className="page-shell pt-8 lg:pt-12">
      <div className="max-w-prose">
        <p className="mono mb-2 text-[0.72rem] font-bold uppercase tracking-[0.12em] text-primary">Side by side</p>
        <h1 className="h2">Compare countries</h1>
        <p className="body-scale mt-2 text-soft">Pick 2 to 4 countries. Cells that differ get a green marker.</p>
      </div>

      {/* selected chips */}
      <div className="mt-6 flex flex-wrap items-center gap-2" aria-label="Selected countries">
        <AnimatePresence initial={false}>
          {selected.map((code) => {
            const c = data[code] ?? cache.current[code];
            return (
              <motion.span
                key={code}
                layout={!reduce}
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.18, ease: EASE_EXPO }}
                className="chip !py-1.5 !pl-1.5 !pr-2 text-[0.82rem]"
              >
                <img
                  src={`/assets/v1/icons/32x24/${code}.png`}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  width={22}
                  height={16}
                  className="rounded-[4px] border border-border object-cover"
                />
                <span className="font-semibold text-strong">{c?.name ?? code.toUpperCase()}</span>
                <button
                  onClick={() => remove(code)}
                  aria-label={`Remove ${c?.name ?? code}`}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-primary-subtle hover:text-primary"
                >
                  <X size={13} />
                </button>
              </motion.span>
            );
          })}
        </AnimatePresence>
        {selected.length < 2 && <Chip>Pick at least 2 to compare</Chip>}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <AddCountry all={all} selected={selected} onAdd={add} />
        <div className="flex min-w-[220px] flex-1 items-center gap-3">
          <label htmlFor="flag-size" className="small-scale shrink-0 font-semibold text-soft">
            Flag size
          </label>
          <input
            id="flag-size"
            type="range"
            min={0.5}
            max={1}
            step={0.01}
            value={flagScale}
            onChange={(e) => setFlagScale(Number(e.target.value))}
            className="slider w-full"
            aria-valuetext={`${Math.round(flagScale * 100)} percent`}
          />
          <span className="mono w-11 shrink-0 text-right text-[0.78rem] text-soft">{Math.round(flagScale * 100)}%</span>
        </div>
      </div>

      {selected.length < 2 ? (
        <div className="mt-6">
          <EmptyState
            icon={<Plus size={26} />}
            title="Add one more country."
            hint="Comparison needs at least two countries. Search above to add another."
          />
        </div>
      ) : (
        <>
          {/* flag cards — swipeable snap row on mobile */}
          <motion.div
            layout={!reduce}
            transition={SPRING_LAYOUT}
            className={`mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 sm:grid sm:overflow-visible ${gridCols}`}
          >
            {selected.map((code, i) => {
              const c = countries[i];
              return (
                <motion.div
                  key={code}
                  layout={!reduce}
                  custom={i}
                  variants={reduce ? colVariantsReduced : colVariants}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  transition={SPRING_LAYOUT}
                  className="w-[240px] shrink-0 snap-start sm:w-auto"
                >
                  {!c ? (
                    <Skeleton height={190} />
                  ) : (
                    <Link href={`/country/${c.code}`} className="card block p-4 no-underline transition-colors hover:border-primary">
                      <motion.div
                        animate={{ scale: flagScale }}
                        transition={reduce ? { duration: 0.01 } : { type: 'spring', stiffness: 200, damping: 25 }}
                        style={{ transformOrigin: '50% 20%' }}
                      >
                        <FlagImage code={c.code} name={c.name} size="w640" aspect="3 / 2" />
                      </motion.div>
                      <p className="mt-3 truncate text-center text-[0.95rem] font-bold">
                        {c.meta.emoji} {c.name}
                      </p>
                      <p className="mt-1 text-center">
                        <Chip variant="iso">{c.code}</Chip>
                      </p>
                    </Link>
                  )}
                </motion.div>
              );
            })}
          </motion.div>

          {/* mobile sticky compare CTA above the tab bar */}
          {ready && (
            <div className="sticky-cta mt-4 sm:hidden">
              <a href="#compare-table" className="btn btn-primary shadow-card-hover">
                Compare below <ArrowDown size={16} aria-hidden />
              </a>
            </div>
          )}

          {/* metadata table */}
          <div id="compare-table" className="card mt-6 scroll-mt-32 overflow-x-auto p-1 sm:p-2">
            {!ready ? (
              <div className="flex flex-col gap-2 p-3">
                <Skeleton height={44} />
                <Skeleton height={44} />
                <Skeleton height={44} />
              </div>
            ) : (
              <table className="meta-table min-w-[560px]">
                <thead>
                  <tr>
                    <th scope="col">Field</th>
                    {(countries as Country[]).map((c) => (
                      <th key={c.code} scope="col" className="!w-auto">
                        <span className="inline-flex items-center gap-2 text-strong">
                          <img
                            src={`/assets/v1/icons/32x24/${c.code}.png`}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            width={20}
                            height={15}
                            className="rounded-[3px] border border-border object-cover"
                          />
                          {c.name}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {KEYS.map((k, row) => {
                    const vals = (countries as Country[]).map((c) => cellValue(c, k));
                    const diff = new Set(vals).size > 1;
                    return (
                      <motion.tr
                        key={k}
                        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-20px' }}
                        transition={{ duration: 0.3, delay: Math.min(row, 9) * STAGGER, ease: EASE_EXPO }}
                      >
                        <th scope="row">{k.replace(/_/g, ' ')}</th>
                        {vals.map((v, i) => (
                          <td key={i} className={diff ? 'diff-cell' : ''}>
                            {diff && <span className="diff-dot" aria-hidden />}
                            <span className="mono-val">{v}</span>
                          </td>
                        ))}
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <p className="small-scale mt-3 text-soft">
            <span className="diff-dot" aria-hidden /> marks cells where the values differ.
          </p>
        </>
      )}
    </div>
  );
}
