'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  ArrowLeftRight,
  BookOpen,
  Compass,
  FileStack,
  Gauge,
  Globe2,
  Search,
  Zap,
} from 'lucide-react';
import { Country } from '../lib/api';
import { getCountries, highlightSegments, matchesQuery } from '../lib/countries';
import { EASE_EXPO, STAGGER } from '../lib/motion';
import { Button, Chip, SectionHeading } from '../components/ui';
import { CodeBlock } from '../components/code-block';
import { Stat } from '../components/stat';

/* ── hero search with live keyboard-navigable results ─────────────── */

function HeroSearch({ countries }: { countries: Country[] }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);
  const router = useRouter();
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const nq = q.trim().toLowerCase();
    if (!nq) return [];
    return countries.filter((c) => matchesQuery(c, nq)).slice(0, 7);
  }, [countries, q]);

  const open = focused && q.trim().length > 0;

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const go = (code: string) => {
    setQ('');
    router.push(`/country/${code}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' && results.length) {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === 'ArrowUp' && results.length) {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === 'Enter' && results.length) {
      e.preventDefault();
      go(results[Math.min(active, results.length - 1)].code);
    } else if (e.key === 'Escape') {
      setQ('');
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="relative mx-auto w-full max-w-[560px]" onKeyDown={onKeyDown}>
      <div className="search-wrap">
        <span className="search-icon" aria-hidden>
          <Search size={19} />
        </span>
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="hero-results"
          aria-activedescendant={open && results.length ? `hero-result-${active}` : undefined}
          aria-label="Search countries"
          autoComplete="off"
          spellCheck={false}
          className="search-input h-[56px] rounded-2xl text-[1rem]"
          placeholder="Search 254 countries… (try “bangla”)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
        />
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={listRef}
            id="hero-results"
            role="listbox"
            aria-label="Country results"
            className="card absolute inset-x-0 top-[calc(100%+8px)] z-50 overflow-hidden p-1.5"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: EASE_EXPO }}
          >
            {results.length === 0 ? (
              <p className="small-scale px-3 py-3 text-soft">
                No matches. Try a name or ISO code like “bd”.
              </p>
            ) : (
              results.map((c, i) => (
                <button
                  key={c.code}
                  id={`hero-result-${i}`}
                  data-idx={i}
                  role="option"
                  aria-selected={i === active}
                  className={`flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left transition-colors ${
                    i === active ? 'bg-primary-subtle' : ''
                  }`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(c.code)}
                >
                  <span className="palette-thumb" aria-hidden>
                    <img src={`/assets/v1/images/w80/${c.code}.png`} alt="" loading="lazy" decoding="async" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[0.9rem] font-medium">
                    {highlightSegments(c.name, q.trim().toLowerCase()).map((s, j) =>
                      s.hit ? (
                        <mark key={j} className="search-hit">
                          {s.text}
                        </mark>
                      ) : (
                        <span key={j}>{s.text}</span>
                      ),
                    )}
                  </span>
                  <Chip variant="iso">{c.code}</Chip>
                </button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── flag wall marquee ────────────────────────────────────────────── */

const WALL_A = ['us', 'jp', 'br', 'de', 'in', 'gb-eng', 'fr', 'ca', 'au', 'es', 'it', 'bd', 'mx', 'kr', 'za', 'se'];
const WALL_B = ['no', 'dk', 'fi', 'nl', 'ch', 'pt', 'gr', 'pl', 'ua', 'tr', 'eg', 'ng', 'ke', 'ar', 'cl', 'nz'];

function MarqueeImg({ code, eager }: { code: string; eager: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  // cached images can complete before hydration attaches onLoad
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) setLoaded(true);
  }, []);
  // a missing file must never leave a blank hole in the wall — show its ISO chip instead
  if (failed) {
    return (
      <span className="flex h-full w-full items-center justify-center" style={{ background: 'var(--surface-muted)' }}>
        <span className="chip chip-iso">{code}</span>
      </span>
    );
  }
  return (
    <img
      ref={imgRef}
      src={`/assets/v1/images/w160/${code}.png`}
      alt=""
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      width={104}
      height={70}
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
      className={loaded ? 'is-loaded' : ''}
    />
  );
}

function MarqueeRow({ codes, reverse = false, label, eager = false }: { codes: string[]; reverse?: boolean; label: string; eager?: boolean }) {
  const doubled = [...codes, ...codes];
  return (
    <div className="marquee" aria-label={label} role="img">
      <div className={`marquee-track ${reverse ? 'reverse' : ''}`}>
        {doubled.map((code, i) => (
          <span key={`${code}-${i}`} className="flag-frame marquee-flag" aria-hidden={i >= codes.length}>
            <MarqueeImg code={code} eager={!!eager && i < codes.length} />
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── headline with per-word stagger ───────────────────────────────── */

function Headline() {
  const reduce = useReducedMotion();
  const words = ['Country', 'flags,', 'served', 'at', 'RAM', 'speed.'];
  return (
    <motion.h1
      className="display-1"
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: reduce ? 0 : 0.035 } } }}
    >
      {words.map((w, i) => (
        <motion.span
          key={i}
          className="inline-block"
          variants={{
            hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 22 },
            show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_EXPO } },
          }}
        >
          {w === 'RAM' ? <span className="text-primary">{w}</span> : w}
          {i < words.length - 1 ? ' ' : ''}
        </motion.span>
      ))}
    </motion.h1>
  );
}

/* ── feature grid ─────────────────────────────────────────────────── */

const FEATURES = [
  { Icon: Zap, title: 'Zero-copy serving', body: 'sendfile straight from disk to socket. No app-server copies, no database in the hot path.' },
  { Icon: Globe2, title: 'Immutable caching', body: '/assets/v1/* ships max-age=31536000, immutable. Bump the version to invalidate, never a query string.' },
  { Icon: FileStack, title: '7 formats', body: 'SVG, WebP, PNG and JPG for the web, plus PDF, AI and EPS masters with Range support.' },
  { Icon: ArrowLeftRight, title: 'Accept negotiation', body: 'Omit ?format= and the resolver serves WebP to modern browsers, PNG everywhere else.' },
  { Icon: Compass, title: '254 pages pre-rendered', body: 'Every country page is statically generated at build time. First paint never waits on an API.' },
  { Icon: Gauge, title: 'Rate-limit friendly', body: 'Generous per-IP token bucket. Exceeding it returns 429 with Retry-After, never a silent drop.' },
];

/* ── page ─────────────────────────────────────────────────────────── */

type AssetStats = { countries: number; total_files: number; total_bytes: number };

export default function Home() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [stats, setStats] = useState<AssetStats | null>(null);

  useEffect(() => {
    getCountries().then(setCountries);
    fetch('/api/v1/assets')
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => {
        if (m) setStats({ countries: m.countries ?? 254, total_files: m.total_files ?? 0, total_bytes: m.total_bytes ?? 0 });
      })
      .catch(() => {});
  }, []);

  const gb = (stats?.total_bytes ?? 0) / 1024 / 1024 / 1024;

  return (
    <>
      {/* hero */}
      <section className="relative overflow-hidden pb-14 pt-16 sm:pt-24">
        <div className="hero-glow" aria-hidden>
          <span className="mesh-blob mesh-blob-a" />
          <span className="mesh-blob mesh-blob-b" />
        </div>
        <div className="landing-shell relative text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE_EXPO }}
            className="mb-6 flex items-center justify-center gap-2"
          >
            <Chip variant="iso">api v1</Chip>
            <Chip>254 countries</Chip>
            <Chip className="hidden sm:inline-flex">CORS open</Chip>
          </motion.div>
          <Headline />
          <motion.p
            className="body-scale mx-auto mt-5 max-w-[620px] text-soft"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05, ease: EASE_EXPO }}
          >
            Metadata + flag assets for every country. One Go binary, zero-copy sendfile delivery, immutable caching. No
            database. No Node in production.
          </motion.p>
          <motion.div
            className="mt-8"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1, ease: EASE_EXPO }}
          >
            <HeroSearch countries={countries} />
          </motion.div>
          <motion.div
            className="mt-7 flex flex-wrap items-center justify-center gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.15, ease: EASE_EXPO }}
          >
            <Button href="/explore" size="lg">
              Explore all countries <ArrowRight size={17} aria-hidden />
            </Button>
            <Button href="/docs" variant="secondary" size="lg">
              <BookOpen size={17} aria-hidden /> API docs
            </Button>
          </motion.div>
        </div>
      </section>

      {/* flag wall */}
      <section className="flex flex-col gap-1 py-4" aria-hidden={false}>
        <MarqueeRow codes={WALL_A} eager label="Scrolling wall of country flags, row one" />
        <MarqueeRow codes={WALL_B} reverse label="Scrolling wall of country flags, row two" />
      </section>

      {/* daily quiz teaser */}
      <section className="landing-shell pt-4">
        <motion.div
          className="quiz-daily flex flex-wrap items-center gap-4"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, ease: EASE_EXPO }}
        >
          <div className="min-w-0 flex-1">
            <p className="mono text-[0.7rem] font-bold uppercase tracking-[0.12em] text-primary">Daily Flag Quiz</p>
            <p className="mt-1 text-[1.05rem] font-bold tracking-tight">Same seed worldwide. 10 questions. Midnight UTC resets.</p>
          </div>
          <Button href="/quiz" size="lg">
            Play today&apos;s challenge <ArrowRight size={17} aria-hidden />
          </Button>
        </motion.div>
      </section>

      {/* stats band */}
      <section className="landing-shell py-16 sm:py-20">
        <motion.div
          className="card grid grid-cols-2 gap-8 px-6 py-10 sm:grid-cols-4"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5, ease: EASE_EXPO }}
        >
          <Stat value={stats?.countries ?? 254} label="Countries" />
          <Stat value={stats?.total_files ?? 27612} label="Assets" />
          <Stat value={stats ? gb : 0.54} label="GB served" decimals={2} />
          <Stat value={7} label="Formats" />
        </motion.div>
      </section>

      {/* code sample */}
      <section className="landing-shell pb-16 sm:pb-20">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5, ease: EASE_EXPO }}
        >
          <SectionHeading
            align="center"
            eyebrow="Copy-paste ready"
            title="Working code in under a minute"
            description="One domain for metadata, resolution and immutable files. No SDK, no auth, no signup."
          />
          <div className="mx-auto mt-8 max-w-[760px]">
            <CodeBlock
              title="terminal"
              tabs={[
                { label: 'curl', code: `curl https://flags.example.com/api/flags/bd?size=320&format=webp --output bd.webp\n\ncurl https://flags.example.com/api/v1/countries/bd | jq .meta.capital\n# "Dhaka"` },
                { label: 'JavaScript', code: `const res = await fetch('/api/v1/countries/bd');\nconst { meta, flags } = await res.json();\nconsole.log(meta.capital); // "Dhaka"\n\n// <img> with immutable caching\n<img src="/assets/v1/images/w320/bd.png" loading="lazy" decoding="async" alt="Flag of Bangladesh" />` },
                { label: 'Go', code: `resp, err := http.Get(base + "/api/v1/countries/bd")\nif err != nil { log.Fatal(err) }\ndefer resp.Body.Close()\n\nvar country struct {\n  Name string \`json:"name"\`\n  Meta struct {\n    Capital string \`json:"capital"\`\n  } \`json:"meta"\`\n}\njson.NewDecoder(resp.Body).Decode(&country)` },
                { label: 'Python', code: `import httpx\n\nr = httpx.get(f"{base}/api/v1/countries/bd")\nr.raise_for_status()\ncountry = r.json()\nprint(country["meta"]["capital"])  # Dhaka\n\n# stream a flag straight to disk\nwith httpx.stream("GET", f"{base}/api/flags/bd", params={"size": 640}) as s:\n    with open("bd.webp", "wb") as f:\n        for chunk in s.iter_bytes():\n            f.write(chunk)` },
              ]}
            />
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button href="/docs" variant="secondary">
              Read the docs
            </Button>
            <Button href="/playground" variant="ghost">
              Open playground
            </Button>
          </div>
        </motion.div>
      </section>

      {/* features */}
      <section className="landing-shell pb-20">
        <SectionHeading
          eyebrow="Why it’s fast"
          title="Built like infrastructure, not a demo"
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.article
              key={f.title}
              className="feature-card"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.45, delay: Math.min(i, 5) * STAGGER, ease: EASE_EXPO }}
            >
              <span className="feature-icon" aria-hidden>
                <f.Icon size={20} />
              </span>
              <h3 className="text-[1.02rem] font-bold tracking-tight">{f.title}</h3>
              <p className="body-scale mt-2 text-soft">{f.body}</p>
            </motion.article>
          ))}
        </div>
        <p className="small-scale mt-8 text-center text-soft">
          Looking for a specific flag?{' '}
          <Link href="/explore" className="font-semibold text-primary hover:underline">
            Browse all 254 countries
          </Link>
          .
        </p>
      </section>
    </>
  );
}
