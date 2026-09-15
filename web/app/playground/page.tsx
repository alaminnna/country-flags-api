'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Download, FileText, Play, Search } from 'lucide-react';
import { Country } from '../../lib/api';
import { getCountries, matchesQuery } from '../../lib/countries';
import { EASE_EXPO } from '../../lib/motion';
import { CopyButton } from '../../components/copy-button';
import { Chip, SegmentedControl, Skeleton } from '../../components/ui';

type ReqType = 'image' | 'icon' | 'vector';

type Manifest = {
  image_sizes?: string[];
  icon_sizes?: string[];
  by_format?: Record<string, number>;
};

const FALLBACK_W = ['20', '40', '80', '160', '320', '640', '1280', '2560'];
const FALLBACK_ICON = ['16x12', '32x24', '64x48', '80x60', '128x96', '256x192'];
const RASTER_FORMATS = ['webp', 'png', 'jpg'];
const ICON_FORMATS = ['webp', 'png'];
const VECTOR_FORMATS = ['svg', 'pdf', 'eps', 'ai'];
const RENDERABLE = new Set(['svg', 'webp', 'png', 'jpg']);

function sortSizes(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => {
    const na = parseInt(a.split('x')[0], 10);
    const nb = parseInt(b.split('x')[0], 10);
    return na - nb;
  });
}

/**
 * Playground — request builder constrained to actually-available combos
 * (from /api/v1/assets), live preview with 200ms crossfade, headers +
 * timing in mono, copy-as-curl. Deep-linkable: ?code=&type=&format=&size=.
 */
export default function Playground() {
  const [all, setAll] = useState<Country[]>([]);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [code, setCode] = useState('bd');
  const [type, setType] = useState<ReqType>('image');
  const [format, setFormat] = useState('webp');
  const [size, setSize] = useState('320');
  const [pickerQ, setPickerQ] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  const [status, setStatus] = useState('');
  const [ok, setOk] = useState(true);
  const [headers, setHeaders] = useState<Record<string, string>>({});
  const [ms, setMs] = useState<number | null>(null);
  const [imgKey, setImgKey] = useState(0);
  const [running, setRunning] = useState(false);
  const [mobileTab, setMobileTab] = useState<'request' | 'preview' | 'response'>('request');
  const reduce = useReducedMotion();

  useEffect(() => {
    getCountries().then(setAll);
    fetch('/api/v1/assets')
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => m && setManifest(m))
      .catch(() => {});
  }, []);

  // available combos from the global manifest
  const wSizes = useMemo(() => {
    const raw = manifest?.image_sizes?.filter((s) => /^\d+$/.test(s)) ?? [];
    return sortSizes(raw.length ? raw : FALLBACK_W);
  }, [manifest]);
  const iconSizes = useMemo(() => {
    const raw = manifest?.icon_sizes?.filter((s) => /^\d+x\d+$/.test(s)) ?? [];
    return sortSizes(raw.length ? raw : FALLBACK_ICON);
  }, [manifest]);

  const formatsFor = (t: ReqType) => (t === 'image' ? RASTER_FORMATS : t === 'icon' ? ICON_FORMATS : VECTOR_FORMATS);

  // deep-link prefill (static-export safe: runs in the browser only)
  useEffect(() => {
    if (prefilled) return;
    const sp = new URLSearchParams(window.location.search);
    const c = (sp.get('code') ?? '').toLowerCase();
    const t = (sp.get('type') ?? '').toLowerCase() as ReqType;
    const f = (sp.get('format') ?? '').toLowerCase();
    const s = sp.get('size') ?? '';
    if (c) setCode(c);
    if (t === 'image' || t === 'icon' || t === 'vector') {
      setType(t);
      const valid = formatsFor(t);
      setFormat(valid.includes(f) ? f : valid[0]);
    } else if (f) {
      const valid = formatsFor('image');
      if (valid.includes(f)) setFormat(f);
    }
    if (s) setSize(s);
    setPrefilled(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefilled]);

  // clamp size/format when the type changes
  useEffect(() => {
    const valid = formatsFor(type);
    if (!valid.includes(format)) setFormat(valid[0]);
    if (type === 'image' && !/^\d+$/.test(size)) setSize('320');
    if (type === 'icon' && !/^\d+x\d+$/.test(size)) setSize('80x60');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const params = type === 'vector' ? `type=${type}&format=${format}` : `type=${type}&format=${format}&size=${size}`;
  const url = `/api/flags/${code}?${params}`;

  const run = async () => {
    if (running) return;
    setRunning(true);
    try {
      const t0 = performance.now();
      const r = await fetch(url);
      const dt = performance.now() - t0;
      setMs(dt);
      setOk(r.ok);
      setStatus(`${r.status} ${r.statusText || (r.ok ? 'OK' : 'Error')}`);
      const h: Record<string, string> = {};
      r.headers.forEach((v, k) => {
        h[k] = v;
      });
      setHeaders(h);
      await r.blob().catch(() => null);
      setImgKey((k) => k + 1);
    } catch (e) {
      setOk(false);
      setStatus('Network error');
      setHeaders({});
    } finally {
      setRunning(false);
      // on phones, jump straight to the result (thumb-travel saver)
      if (window.matchMedia('(max-width: 767px)').matches) {
        setMobileTab('preview');
      }
    }
  };

  // auto-run once inputs + country list are ready (deep links resolve instantly)
  useEffect(() => {
    if (prefilled && all.length > 0 && status === '') {
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefilled, all.length]);

  const countryName = all.find((c) => c.code === code)?.name ?? code.toUpperCase();
  const pickerResults = useMemo(() => {
    const nq = pickerQ.trim().toLowerCase();
    if (!nq) return [];
    return all.filter((c) => matchesQuery(c, nq)).slice(0, 6);
  }, [all, pickerQ]);

  const curl = `curl -i "${typeof window !== 'undefined' ? window.location.origin : ''}${url}"`;
  const sizes = type === 'icon' ? iconSizes : wSizes;
  const renderable = RENDERABLE.has(format);

  const builder = (
    <div className="flex flex-col gap-5">
      <div>
        <label className="field-label" htmlFor="pg-country">Country</label>
        <div className="relative">
          <div className="search-wrap">
            <span className="search-icon" aria-hidden>
              <Search size={16} />
            </span>
            <input
              id="pg-country"
              type="text"
              role="combobox"
              aria-expanded={pickerOpen && pickerResults.length > 0}
              aria-label="Country code or name"
              autoComplete="off"
              spellCheck={false}
              className="search-input h-[44px] !pl-10 text-[0.88rem]"
              placeholder={countryName}
              value={pickerQ}
              onChange={(e) => {
                setPickerQ(e.target.value);
                setPickerOpen(true);
              }}
              onFocus={() => setPickerOpen(true)}
              onBlur={() => window.setTimeout(() => setPickerOpen(false), 120)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && pickerResults.length > 0) {
                  setCode(pickerResults[0].code);
                  setPickerQ('');
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
          </div>
          <AnimatePresence>
            {pickerOpen && pickerResults.length > 0 && (
              <motion.div
                role="listbox"
                aria-label="Matching countries"
                className="card absolute inset-x-0 top-[calc(100%+6px)] z-50 p-1.5"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15, ease: EASE_EXPO }}
              >
                {pickerResults.map((c) => (
                  <button
                    key={c.code}
                    role="option"
                    aria-selected={c.code === code}
                    className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left hover:bg-primary-subtle"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setCode(c.code);
                      setPickerQ('');
                    }}
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
        <p className="small-scale mt-1.5 text-soft">
          Selected: <strong className="text-strong">{countryName}</strong> <Chip variant="iso">{code}</Chip>
        </p>
      </div>

      <div>
        <span className="field-label" id="pg-type">Type</span>
        <SegmentedControl
          ariaLabel="Asset type"
          value={type}
          onChange={(v) => setType(v as ReqType)}
          options={[
            { value: 'image', label: 'Image' },
            { value: 'icon', label: 'Icon' },
            { value: 'vector', label: 'Vector' },
          ]}
        />
      </div>

      <div>
        <label className="field-label" htmlFor="pg-format">Format</label>
        <select id="pg-format" className="field-select w-full" value={format} onChange={(e) => setFormat(e.target.value)}>
          {formatsFor(type).map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      {type !== 'vector' && (
        <div>
          <label className="field-label" htmlFor="pg-size">
            Size {type === 'image' ? '(width px)' : '(WxH)'}
          </label>
          <select id="pg-size" className="field-select w-full" value={size} onChange={(e) => setSize(e.target.value)}>
            {sizes.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      )}

      <button className="btn btn-primary w-full" onClick={run} disabled={running}>
        <Play size={16} aria-hidden /> {running ? 'Running…' : 'Run request'}
      </button>
    </div>
  );

  const previewBlock = (
    <section aria-label="Response preview" className="card h-fit p-5">
      <h2 className="mb-4 hidden text-[0.95rem] font-bold lg:block">Preview</h2>
      <div className="preview-frame" style={{ aspectRatio: '3 / 2' }}>
        {renderable && ok !== false ? (
          <AnimatePresence mode="wait" initial={false}>
            <motion.img
              key={`${url}#${imgKey}`}
              src={url}
              alt={`Flag preview for ${countryName}`}
              decoding="async"
              draggable={false}
              className="h-full w-full object-contain"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0.01 : 0.2, ease: EASE_EXPO }}
            />
          </AnimatePresence>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <span className="feature-icon" aria-hidden>
              <FileText size={20} />
            </span>
            <p className="text-[0.9rem] font-bold">{format.toUpperCase()} master</p>
            <p className="small-scale max-w-[240px] text-soft">
              {ok === false ? 'The resolver returned an error for this combo.' : 'Binary masters don’t render inline — download to inspect.'}
            </p>
            <a className="btn btn-secondary btn-sm mt-1" href={url} download>
              <Download size={14} aria-hidden /> Download file
            </a>
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <CopyButton text={url} label="Copy URL" showLabel />
        <CopyButton text={curl} label="Copy as curl" showLabel />
      </div>
    </section>
  );

  const responseBlock = (
    <section aria-label="Response details" className="card h-fit p-5">
      <h2 className="mb-4 hidden text-[0.95rem] font-bold lg:block">Response</h2>
      <div className="flex items-center gap-3">
        <span className="small-scale font-semibold text-soft">Timing</span>
        <span className="mono text-[0.85rem] font-bold">{ms !== null ? `${ms.toFixed(1)} ms` : '—'}</span>
        <span className="small-scale ml-auto hidden text-soft sm:inline">measured with performance.now()</span>
      </div>
      <p className="field-label mt-5">Headers</p>
      <div className="code-body !rounded-xl">
        <pre>
          {Object.keys(headers).length === 0
            ? '— run a request —'
            : Object.entries(headers)
                .map(([k, v]) => `${k}: ${v}`)
                .join('\n')}
        </pre>
      </div>
      <p className="field-label mb-2 mt-5">Curl</p>
      <div className="code-body !rounded-xl">
        <pre className="break-all" style={{ whiteSpace: 'pre-wrap' }}>{curl}</pre>
      </div>
    </section>
  );

  return (
    <div className="page-shell pt-8 lg:pt-12">
      <div className="max-w-prose">
        <p className="mono mb-2 text-[0.72rem] font-bold uppercase tracking-[0.12em] text-primary">Live</p>
        <h1 className="h2">API playground</h1>
        <p className="body-scale mt-2 text-soft">Every combo here is real — constrained to what the API actually serves.</p>
      </div>

      <div className="mt-6">
        <code className="mono block break-all rounded-xl border border-border bg-surface px-4 py-3 text-[0.82rem] font-semibold">
          {url}
        </code>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {status ? (
            <span className={`chip ${ok ? 'chip-active' : ''}`} style={ok ? undefined : { background: 'var(--destructive-subtle)', borderColor: 'transparent', color: 'var(--destructive)' }}>
              {status}
            </span>
          ) : (
            <Skeleton height={26} className="w-28 !min-h-[26px]" />
          )}
          {ms !== null && <span className="mono text-[0.8rem] text-soft">{ms.toFixed(1)} ms</span>}
        </div>
      </div>

      {/* mobile: Request / Preview / Response tabs (sticky, thumb-friendly) */}
      <div className="lg:hidden">
        <div className="sticky top-[var(--m-topbar,56px)] z-30 -mx-4 mt-5 bg-bg/90 px-4 py-2 backdrop-blur-md" data-noswipe>
          <SegmentedControl
            ariaLabel="Playground sections"
            value={mobileTab}
            onChange={(v) => setMobileTab(v as typeof mobileTab)}
            className="w-full"
            options={[
              { value: 'request', label: 'Request' },
              { value: 'preview', label: 'Preview' },
              { value: 'response', label: ms !== null ? `Response · ${ms.toFixed(0)}ms` : 'Response' },
            ]}
          />
        </div>
        <div className="mt-4">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={mobileTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {mobileTab === 'request' && <div className="card p-5">{builder}</div>}
              {mobileTab === 'preview' && previewBlock}
              {mobileTab === 'response' && responseBlock}
            </motion.div>
          </AnimatePresence>
        </div>
        {mobileTab !== 'request' && (
          <div className="sticky-cta mt-5">
            <button className="btn btn-primary shadow-card-hover" onClick={run} disabled={running}>
              <Play size={16} aria-hidden /> {running ? 'Running…' : status ? 'Run again' : 'Run request'}
              {ms !== null && <span className="mono text-[0.78rem] opacity-80">{ms.toFixed(0)}ms</span>}
            </button>
          </div>
        )}
      </div>

      {/* desktop: 3 panes */}
      <div className="mt-6 hidden gap-6 lg:grid lg:grid-cols-[minmax(0,4fr)_minmax(0,5fr)_minmax(0,4fr)]">
        <section aria-label="Request builder" className="card h-fit p-5">
          <h2 className="mb-4 text-[0.95rem] font-bold">Request</h2>
          {builder}
        </section>
        {previewBlock}
        {responseBlock}
      </div>
    </div>
  );
}
