'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  FileImage,
  FileText,
  Shapes,
} from 'lucide-react';
import { AssetEntry, Country, fetchJSON, flagUrl, fmtBytes } from '../../../lib/api';
import { getCountries, indexOfCountry } from '../../../lib/countries';
import { useIsMobile } from '../../../lib/hooks';
import { DUR, EASE_EXPO } from '../../../lib/motion';
import { CopyButton } from '../../../components/copy-button';
import { JsonViewer } from '../../../components/json-viewer';
import { Chip, ErrorState, SegmentedControl, Skeleton } from '../../../components/ui';

const ALL_FORMATS = ['png', 'webp', 'jpg', 'svg'];
const W_SIZES = ['w20', 'w40', 'w80', 'w160', 'w320', 'w640', 'w1280', 'w2560'];
const H_SIZES = ['h20', 'h40', 'h80', 'h160', 'h240'];

function humanize(key: string): string {
  return key.replace(/_/g, ' ');
}

/** keys shown as intro prose / header, not in the metadata table */
const META_SKIP = new Set(['neighbors', 'location', 'emoji', 'emoji_label', 'title', 'note', 'description']);

const QUICK_FACTS = ['capital', 'population', 'area', 'currency', 'calling_code', 'tld'] as const;

type MobileTab = 'overview' | 'assets' | 'json';

const pageVariants = {
  enter: (dir: number) => ({ opacity: 0, x: 56 * dir }),
  center: { opacity: 1, x: 0, transition: { duration: DUR.base, ease: EASE_EXPO } },
  exit: (dir: number) => ({ opacity: 0, x: -56 * dir, transition: { duration: 0.2, ease: EASE_EXPO } }),
};

const pageVariantsReduced = {
  enter: () => ({ opacity: 0 }),
  center: { opacity: 1, transition: { duration: 0.01 } },
  exit: () => ({ opacity: 0, transition: { duration: 0.01 } }),
};

function formatIcon(format: string) {
  if (format === 'svg') return Shapes;
  if (format === 'pdf' || format === 'eps' || format === 'ai') return FileText;
  return FileImage;
}

export default function CountryClient({ code }: { code: string }) {
  const [country, setCountry] = useState<Country | null>(null);
  const [assets, setAssets] = useState<AssetEntry[] | null>(null);
  const [format, setFormat] = useState('png');
  const [size, setSize] = useState('w320');
  const [error, setError] = useState('');
  const [allCodes, setAllCodes] = useState<Country[]>([]);
  const [dir, setDir] = useState(0);
  const [tab, setTab] = useState<MobileTab>('overview');
  const router = useRouter();
  const reduce = useReducedMotion();
  const isMobile = useIsMobile();
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  // (re)load on code change; selection of format/size carries over
  useEffect(() => {
    setCountry(null);
    setAssets(null);
    setError('');
    window.scrollTo({ top: 0, behavior: 'auto' });
    fetchJSON<Country>(`/api/v1/countries/${code}`)
      .then(setCountry)
      .catch(() => setError('Country not found.'));
    fetchJSON<AssetEntry[]>(`/api/v1/countries/${code}/assets`)
      .then(setAssets)
      .catch(() => setAssets([]));
    getCountries().then(setAllCodes);
  }, [code]);

  const idx = useMemo(() => indexOfCountry(allCodes, code), [allCodes, code]);
  const prev = idx > 0 ? allCodes[idx - 1] : null;
  const next = idx >= 0 && idx < allCodes.length - 1 ? allCodes[idx + 1] : null;

  const nav = (d: -1 | 1) => {
    const target = d === -1 ? prev : next;
    if (!target) return;
    setDir(d);
    router.push(`/country/${target.code}`);
  };

  // keyboard ← → country navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const t = e.target as HTMLElement | null;
      if (t && t.closest('input, select, textarea, [role="combobox"], [role="dialog"]')) return;
      if (e.key === 'ArrowLeft') nav(-1);
      else nav(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // swipe anywhere (except scrollable controls) = prev/next country
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touchStart.current;
    touchStart.current = null;
    if (!s || !isMobile) return;
    const target = e.target as HTMLElement | null;
    if (target && target.closest('[data-noswipe]')) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      setDir(dx < 0 ? 1 : -1);
      nav(dx < 0 ? 1 : -1);
    }
  };

  const previewUrl =
    format === 'svg'
      ? flagUrl(code, { type: 'vector', format: 'svg' })
      : flagUrl(code, { size, format });

  const meta = useMemo(
    () => (country ? (country.meta as unknown as Record<string, unknown>) : null),
    [country],
  );

  const tableEntries = useMemo(() => {
    if (!meta) return [];
    return Object.entries(meta).filter(([k]) => !META_SKIP.has(k));
  }, [meta]);

  const neighbors = useMemo(() => {
    const n = meta?.neighbors;
    return Array.isArray(n) ? (n as { name: string; code: string }[]) : [];
  }, [meta]);

  const groups = useMemo(() => {
    if (!assets) return [];
    const order = ['image', 'icon', 'vector'] as const;
    const titles: Record<string, string> = { image: 'Raster images', icon: 'Icons', vector: 'Vector masters' };
    return order
      .map((kind) => ({ kind, title: titles[kind], rows: assets.filter((a) => a.type === kind) }))
      .filter((g) => g.rows.length > 0);
  }, [assets]);

  const quickFacts = useMemo(() => {
    if (!meta) return [];
    return QUICK_FACTS.map((k): { key: string; value: unknown } => ({ key: k, value: meta[k] })).filter(
      (f) => f.value !== undefined && f.value !== null && String(f.value).trim() !== '',
    );
  }, [meta]);

  const note = typeof meta?.note === 'string' ? meta.note : '';
  const description = typeof meta?.description === 'string' ? meta.description : '';

  const variants = reduce ? pageVariantsReduced : pageVariants;

  const formatSeg = (
    <SegmentedControl
      ariaLabel="Preview format"
      value={format}
      onChange={setFormat}
      options={ALL_FORMATS.map((f) => ({ value: f, label: f.toUpperCase() }))}
    />
  );
  const sizeSeg = format !== 'svg' && (
    <div data-noswipe>
      <SegmentedControl
        ariaLabel="Preview size"
        value={size}
        onChange={setSize}
        scrollable
        className="max-w-full"
        options={[...W_SIZES, ...H_SIZES].map((s) => ({ value: s, label: s }))}
      />
    </div>
  );

  const previewBlock = (
    <div className="preview-frame" style={{ aspectRatio: '3 / 2' }}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.img
          key={previewUrl}
          src={previewUrl}
          alt={country ? `Flag of ${country.name}` : 'Flag preview'}
          loading="eager"
          decoding="async"
          draggable={false}
          className="h-full w-full object-contain"
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE_EXPO }}
        />
      </AnimatePresence>
    </div>
  );

  const quickFactsBlock = quickFacts.length > 0 && (
    <div className="card mt-4 p-4">
      <p className="mono mb-3 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-soft">Quick facts</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        {quickFacts.map((f) => (
          <div key={f.key} className="min-w-0">
            <dt className="small-scale font-semibold normal-case text-soft">{humanize(f.key)}</dt>
            <dd className="truncate text-[0.9rem] font-semibold" title={String(f.value)}>
              {String(f.value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );

  const metaBlock = (
    <section aria-label="Metadata">
      {(note || description) && (
        <div className="body-scale mb-4 space-y-2 text-soft">
          {note && <p>{note}</p>}
          {description && description !== note && <p>{description}</p>}
        </div>
      )}
      <div className="card overflow-hidden">
        <table className="meta-table">
          <tbody>
            {tableEntries.map(([k, v]) => (
              <tr key={k}>
                <th scope="row">{humanize(k)}</th>
                <td className="mono-val">{Array.isArray(v) ? (v as unknown[]).join(', ') : String(v ?? '—')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {neighbors.length > 0 && (
        <div className="mt-4">
          <p className="mono mb-2 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-soft">Neighbors</p>
          <div className="flex flex-wrap gap-2">
            {neighbors.map((n) => (
              <Link
                key={n.code}
                href={`/country/${n.code}`}
                className="chip transition-colors hover:border-primary hover:text-primary"
              >
                <img
                  src={`/assets/v1/icons/32x24/${n.code}.png`}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  width={18}
                  height={13}
                  className="rounded-[3px] object-cover"
                />
                {n.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );

  const assetsBlock = (
    <section aria-label="All assets">
      {!assets ? (
        <div className="flex flex-col gap-2">
          <Skeleton height={54} />
          <Skeleton height={54} />
          <Skeleton height={54} />
        </div>
      ) : assets.length === 0 ? (
        <p className="small-scale text-soft">No asset manifest available for this country.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((g) => (
            <div key={g.kind}>
              <p className="mono mb-2 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-soft">
                {g.title} · {g.rows.length}
              </p>
              <div className="flex flex-col gap-2">
                {g.rows.map((a) => {
                  const Icon = formatIcon(a.format);
                  return (
                    <div key={a.url} className="asset-row flex-wrap sm:flex-nowrap" data-noswipe>
                      <span className="inline-flex shrink-0 items-center gap-2">
                        <Icon size={16} className="text-soft" aria-hidden />
                        <span className="mono text-[0.75rem] font-bold uppercase">{a.format}</span>
                      </span>
                      <Chip variant="iso">{a.size || '—'}</Chip>
                      <span className="mono shrink-0 text-[0.75rem] text-soft">{fmtBytes(a.bytes)}</span>
                      <span className="url-clip min-w-[140px] flex-1" title={a.url}>
                        {a.url}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <CopyButton text={a.url} label={`Copy ${a.format} ${a.size} URL`} />
                        <a className="copy-btn" href={a.url} download aria-label={`Download ${a.format} ${a.size}`} title="Download">
                          <Download size={15} />
                        </a>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );

  const jsonBlock = country ? (
    <JsonViewer data={country} title={`${country.code}.json`} />
  ) : (
    <Skeleton height={220} />
  );

  return (
    <div className="page-shell pt-6 lg:pt-10" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.div key={code} custom={dir} variants={variants} initial="enter" animate="center" exit="exit">
          {error ? (
            <ErrorState
              title="Country not found."
              hint={`No data for “${code}”. It may be an unknown code — try the explore page.`}
            />
          ) : !country ? (
            <div>
              <Skeleton height={36} className="mb-4 max-w-sm" />
              <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
                <Skeleton height={340} />
                <div className="flex flex-col gap-3">
                  <Skeleton height={120} />
                  <Skeleton height={220} />
                </div>
              </div>
            </div>
          ) : (
            <>
              <p className="mb-3">
                <Link href="/explore" className="small-scale inline-flex items-center gap-1.5 font-semibold text-soft transition-colors hover:text-primary">
                  <ArrowLeft size={15} aria-hidden /> All countries
                </Link>
              </p>
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <span className="text-[2rem] leading-none" role="img" aria-label={String(meta?.emoji_label ?? 'flag')}>
                  {String(meta?.emoji ?? '')}
                </span>
                <div className="min-w-0">
                  <h1 className="h2 leading-none">{country.name}</h1>
                  <p className="small-scale mt-1.5 text-soft">
                    {String(meta?.official_name ?? '')}
                    {meta?.continent ? ` · ${String(meta.continent)}` : ''}
                  </p>
                </div>
                <span className="ml-auto flex items-center gap-2">
                  <Chip variant="iso">{country.code}</Chip>
                  <CopyButton text={`/api/v1/countries/${country.code}`} label="Copy metadata API URL" showLabel />
                </span>
              </div>

              {/* desktop split view */}
              <div className="hidden gap-10 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
                <div>
                  <div className="sticky top-[88px]">
                    {previewBlock}
                    <div className="mt-4 flex flex-col gap-3">
                      <div>
                        <p className="field-label">Format</p>
                        {formatSeg}
                      </div>
                      {format !== 'svg' && (
                        <div>
                          <p className="field-label">Size</p>
                          {sizeSeg}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <a className="btn btn-primary btn-sm" href={previewUrl} download={`${country.code}.${format === 'svg' ? 'svg' : format}`}>
                          <Download size={15} aria-hidden /> Download {format.toUpperCase()}
                        </a>
                        <CopyButton text={previewUrl} label="Copy image URL" showLabel />
                      </div>
                    </div>
                    {quickFactsBlock}
                  </div>
                </div>
                <div className="flex min-w-0 flex-col gap-10">
                  <div>
                    <h2 className="h3 mb-3">Metadata</h2>
                    {metaBlock}
                  </div>
                  <div>
                    <h2 className="h3 mb-3">All assets ({assets?.length ?? '…'})</h2>
                    {assetsBlock}
                  </div>
                  <div>
                    <h2 className="h3 mb-3">Raw JSON</h2>
                    {jsonBlock}
                  </div>
                </div>
              </div>

              {/* mobile tabbed hero */}
              <div className="lg:hidden">
                {previewBlock}
                <div className="mt-4 flex flex-col gap-3" data-noswipe>
                  <div>
                    <p className="field-label">Format</p>
                    {formatSeg}
                  </div>
                  {format !== 'svg' && (
                    <div>
                      <label className="field-label" htmlFor={`size-m-${code}`}>
                        Size · {size.replace('w', '').replace('h', '')}px{size.startsWith('h') ? ' tall' : ' wide'}
                      </label>
                      <select
                        id={`size-m-${code}`}
                        className="field-select w-full"
                        value={size}
                        onChange={(e) => setSize(e.target.value)}
                      >
                        <optgroup label="Width">
                          {W_SIZES.map((s) => (
                            <option key={s} value={s}>{s.replace('w', '')} px wide</option>
                          ))}
                        </optgroup>
                        <optgroup label="Height">
                          {H_SIZES.map((s) => (
                            <option key={s} value={s}>{s.replace('h', '')} px tall</option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <a className="btn btn-primary btn-sm flex-1" href={previewUrl} download={`${country.code}.${format === 'svg' ? 'svg' : format}`}>
                      <Download size={15} aria-hidden /> Download
                    </a>
                    <CopyButton text={previewUrl} label="Copy image URL" showLabel />
                  </div>
                </div>
                <div className="sticky top-[var(--m-topbar,56px)] z-30 -mx-4 mt-5 bg-bg/90 px-4 py-2 backdrop-blur-md" data-noswipe>
                  <SegmentedControl
                    ariaLabel="Country sections"
                    value={tab}
                    onChange={(v) => setTab(v as MobileTab)}
                    className="w-full"
                    options={[
                      { value: 'overview', label: 'Overview' },
                      { value: 'assets', label: `Assets${assets ? ` ${assets.length}` : ''}` },
                      { value: 'json', label: 'JSON' },
                    ]}
                  />
                </div>
                <div className="mt-4">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={tab}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                    >
                      {tab === 'overview' && (
                        <div className="flex flex-col gap-5">
                          {quickFactsBlock}
                          {metaBlock}
                        </div>
                      )}
                      {tab === 'assets' && assetsBlock}
                      {tab === 'json' && jsonBlock}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* prev/next: floating arrows on desktop, edge peek on mobile */}
      {prev && (
        <button
          onClick={() => nav(-1)}
          aria-label={`Previous country: ${prev.name}`}
          title={prev.name}
          className="icon-btn card fixed left-5 top-1/2 z-40 hidden h-12 w-12 -translate-y-1/2 rounded-full !border-border lg:inline-flex"
        >
          <ChevronLeft size={20} />
        </button>
      )}
      {next && (
        <button
          onClick={() => nav(1)}
          aria-label={`Next country: ${next.name}`}
          title={next.name}
          className="icon-btn card fixed right-5 top-1/2 z-40 hidden h-12 w-12 -translate-y-1/2 rounded-full !border-border lg:inline-flex"
        >
          <ChevronRight size={20} />
        </button>
      )}
      {isMobile && prev && (
        <button
          onClick={() => nav(-1)}
          aria-label={`Previous country: ${prev.name}`}
          className="fixed left-0 top-1/2 z-40 flex h-24 w-6 -translate-y-1/2 items-center justify-center overflow-hidden rounded-r-xl border-y border-r border-border bg-surface/85 opacity-70 backdrop-blur-sm lg:hidden"
        >
          <img src={`/assets/v1/images/w40/${prev.code}.png`} alt="" loading="lazy" decoding="async" className="h-10 w-4 object-cover" draggable={false} />
        </button>
      )}
      {isMobile && next && (
        <button
          onClick={() => nav(1)}
          aria-label={`Next country: ${next.name}`}
          className="fixed right-0 top-1/2 z-40 flex h-24 w-6 -translate-y-1/2 items-center justify-center overflow-hidden rounded-l-xl border-y border-l border-border bg-surface/85 opacity-70 backdrop-blur-sm lg:hidden"
        >
          <img src={`/assets/v1/images/w40/${next.code}.png`} alt="" loading="lazy" decoding="async" className="h-10 w-4 object-cover" draggable={false} />
        </button>
      )}
      {error && (
        <p className="mt-4">
          <Link href="/explore" className="btn btn-secondary btn-sm">
            Browse all countries
          </Link>
        </p>
      )}
    </div>
  );
}
