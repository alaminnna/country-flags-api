'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion, useScroll } from 'framer-motion';
import { ArrowUpRight, FlaskConical, Info, Lightbulb, ListTree } from 'lucide-react';
import { CodeBlock } from '../../components/code-block';
import { Sheet } from '../../components/sheet';

const NAV = [
  {
    group: 'Getting started',
    links: [{ id: 'overview', label: 'Overview' }],
  },
  {
    group: 'Reference',
    links: [
      { id: 'endpoints', label: 'Endpoints' },
      { id: 'quiz', label: 'Quiz API' },
      { id: 'resolver', label: 'Resolver params' },
      { id: 'formats', label: 'Format guide' },
    ],
  },
  {
    group: 'Operations',
    links: [
      { id: 'caching', label: 'Caching' },
      { id: 'errors', label: 'Errors' },
      { id: 'limits', label: 'Rate limits' },
    ],
  },
];

const ALL_IDS = NAV.flatMap((g) => g.links.map((l) => l.id));

function EndpointRow({
  method,
  path,
  desc,
  tryHref,
  tryLabel = 'Try it',
  rawHref,
}: {
  method: string;
  path: string;
  desc: string;
  tryHref?: string;
  tryLabel?: string;
  rawHref?: string;
}) {
  return (
    <div className="card flex flex-col gap-2 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
      <span className="method-pill shrink-0">{method}</span>
      <code className="mono min-w-0 flex-1 break-all text-[0.82rem] font-semibold">{path}</code>
      <span className="flex shrink-0 items-center gap-2">
        {tryHref && (
          <Link href={tryHref} className="btn btn-secondary btn-sm">
            <FlaskConical size={14} aria-hidden /> {tryLabel}
          </Link>
        )}
        {rawHref && (
          <a href={rawHref} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
            Open JSON <ArrowUpRight size={14} aria-hidden />
          </a>
        )}
      </span>
      <p className="small-scale basis-full text-soft sm:basis-full">{desc}</p>
    </div>
  );
}

function ParamTable({ rows }: { rows: [string, string][] }) {
  return (
    <div className="card overflow-hidden">
      <table className="meta-table">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <th scope="row" className="!w-[130px]">
                <code className="mono text-[0.8rem] font-bold normal-case text-primary">{k}</code>
              </th>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Docs — Stripe-grade 3-column: left nav tree, center content (max 720px),
 * right "on this page" TOC with scroll-spy. Green 2px scroll-progress bar.
 */
export default function Docs() {
  const [active, setActive] = useState('overview');
  const [tocOpen, setTocOpen] = useState(false);
  const { scrollYProgress } = useScroll();
  const reduce = useReducedMotion();
  const observer = useRef<IntersectionObserver | null>(null);

  // scroll-spy
  useEffect(() => {
    observer.current?.disconnect();
    observer.current = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
        }
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 },
    );
    for (const id of ALL_IDS) {
      const el = document.getElementById(id);
      if (el) observer.current.observe(el);
    }
    return () => observer.current?.disconnect();
  }, []);

  const tocList = (
    <nav aria-label="On this page" className="flex flex-col">
      {NAV.flatMap((g) => g.links).map((l) => (
        <a
          key={l.id}
          href={`#${l.id}`}
          onClick={() => setTocOpen(false)}
          className={`toc-link ${active === l.id ? 'is-active' : ''}`}
          aria-current={active === l.id ? 'true' : undefined}
        >
          {l.label}
        </a>
      ))}
    </nav>
  );

  return (
    <div className="page-shell pt-8 lg:pt-12">
      {!reduce && <motion.div className="progress-bar" style={{ scaleX: scrollYProgress }} aria-hidden />}

      <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[220px_minmax(0,1fr)_200px]">
        {/* left nav tree */}
        <aside className="hidden lg:block">
          <nav aria-label="Documentation" className="sticky top-[88px] flex max-h-[calc(100vh-110px)] flex-col gap-5 overflow-y-auto">
            {NAV.map((g) => (
              <div key={g.group}>
                <p className="mono mb-1.5 px-3 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-soft">{g.group}</p>
                {g.links.map((l) => (
                  <a key={l.id} href={`#${l.id}`} className={`docs-nav-link ${active === l.id ? 'is-active' : ''}`}>
                    {l.label}
                  </a>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        {/* center content */}
        <div className="mx-auto w-full max-w-[720px] lg:mx-0">
          <p className="mono mb-2 text-[0.72rem] font-bold uppercase tracking-[0.12em] text-primary">Documentation</p>
          <h1 className="h2">API reference</h1>
          <p className="body-scale mt-2 text-soft">
            One domain, JSON metadata + smart flag resolver + immutable asset URLs. CORS open (<code className="mono">*</code>).
          </p>

          <div className="mt-4 lg:hidden">
            <button className="btn btn-ghost btn-sm w-full" onClick={() => setTocOpen(true)} aria-haspopup="dialog">
              <ListTree size={15} /> On this page
            </button>
          </div>

          <section id="overview" className="mt-10 scroll-mt-24">
            <h2 className="h3 mb-3">Overview</h2>
            <div className="callout callout-tip">
              <span className="callout-icon" aria-hidden>
                <Lightbulb size={17} />
              </span>
              <p>
                <strong>Base URL is wherever you deploy the binary.</strong> Every example here uses a relative path —
                in production it’s <code className="mono">https://your-domain</code> serving both the API and this UI.
              </p>
            </div>
            <div className="mt-4">
              <CodeBlock
                title="quickstart"
                tabs={[
                  { label: 'curl', code: `# metadata for Bangladesh\ncurl /api/v1/countries/bd | jq '{name, capital: .meta.capital}'\n\n# resolve a flag (Accept-negotiated WebP)\ncurl /api/flags/bd?size=320 --output bd.webp` },
                  { label: 'JavaScript', code: `// metadata\nconst meta = await fetch('/api/v1/countries/bd').then(r => r.json());\n\n// every asset URL for a country\nconst assets = await fetch('/api/v1/countries/bd/assets').then(r => r.json());\n// → [{ type: 'image', format: 'webp', size: '320', url: '/assets/v1/...', bytes: 1234 }]` },
                ]}
              />
            </div>
          </section>

          <section id="endpoints" className="mt-12 scroll-mt-24">
            <h2 className="h3 mb-3">Endpoints</h2>
            <div className="flex flex-col gap-3">
              <EndpointRow method="GET" path="/api/v1/countries?search=&region=" desc="List all 254 countries. Optional fuzzy search and region filter (e.g. ?region=Asia)." rawHref="/api/v1/countries" />
              <EndpointRow method="GET" path="/api/v1/countries/{code}" desc="One country. ISO2, ISO3 or numeric code, any case — bd, BGD and 050 all work." rawHref="/api/v1/countries/bd" />
              <EndpointRow method="GET" path="/api/v1/countries/{code}/assets" desc="Every available asset for the country: type, format, size, bytes and canonical URL." rawHref="/api/v1/countries/bd/assets" />
              <EndpointRow method="GET" path="/api/v1/assets" desc="Global manifest: counts, per-format breakdown, image/icon sizes, total bytes." rawHref="/api/v1/assets" />
              <EndpointRow method="GET" path="/api/flags/{code}" desc="Smart resolver. Picks the best variant from ?type=&format=&size= (also mounted at /api/v1/flags/{code})." tryHref="/playground?code=bd&type=image&format=webp&size=320" />
              <EndpointRow method="GET" path="/assets/v1/{…}" desc="Canonical immutable file passthrough. What you put in <img> tags." tryHref="/country/bd" tryLabel="See assets" />
              <EndpointRow method="GET" path="/healthz · /readyz" desc="Liveness and readiness probes for orchestrators." rawHref="/healthz" />
            </div>
          </section>

          <section id="quiz" className="mt-12 scroll-mt-24">
            <h2 className="h3 mb-3">Quiz API</h2>
            <p className="body-scale mb-3 text-soft">
              Stateless seeded quizzes — same <code className="mono">seed+mode+difficulty+count</code> → byte-identical quiz forever. No DB, no sessions. Daily challenge derives the seed from the UTC date.
            </p>
            <div className="flex flex-col gap-3">
              <EndpointRow method="GET" path="/api/v1/quiz/meta" desc="Modes, difficulties, counts + today's daily block." rawHref="/api/v1/quiz/meta" />
              <EndpointRow method="GET" path="/api/v1/quiz/questions?mode=&difficulty=&count=&seed=" desc="Generate a quiz. Seed optional (u64 or string → FNV-1a). With seed → cacheable 86400s." tryHref="/quiz" tryLabel="Play" />
              <EndpointRow method="GET" path="/api/v1/quiz/daily" desc="Today's daily (UTC) + full question set in one call." rawHref="/api/v1/quiz/daily" />
              <EndpointRow method="POST" path="/api/v1/quiz/grade" desc="Stateless grade: server regenerates from seed. Body {seed, mode, difficulty, answers[], timesMs[]}; -1 = timeout." tryHref="/quiz" tryLabel="Play" />
            </div>
            <div className="mt-4">
              <CodeBlock
                title="quiz"
                tabs={[
                  { label: 'curl', code: `# seeded quiz (replays identically)\ncurl "/api/v1/quiz/questions?mode=mixed&difficulty=easy&count=5&seed=42"\n\n# daily\ncurl /api/v1/quiz/daily | jq '{date, dailyNumber, mode}'\n\n# grade (timesMs per question)\ncurl -X POST /api/v1/quiz/grade -d '{"seed":"42","mode":"mixed","difficulty":"easy","answers":[0,1,2,3,0],"timesMs":[900,1200,800,1500,2100]}'` },
                  { label: 'Scoring', code: `// IDENTICAL client + server\ncorrect → 100 + timeBonus + streakBonus\ntimeBonus  = max(0, 50 − floor(ms / 200))  // instant +50, 10s +0\nstreakBonus = 10 × (streak − 1)             // 3rd in a row +20\nwrong / timeout (−1) → 0, streak resets` },
                ]}
              />
            </div>
            <div className="callout callout-tip mt-4">
              <span className="callout-icon" aria-hidden>
                <Lightbulb size={17} />
              </span>
              <p>
                Share links carry <code className="mono">?seed=</code> — opening one reproduces the identical quiz on any device. Daily seed ={' '}
                <code className="mono">FNV1a64(&quot;daily-&quot; + YYYY-MM-DD)</code>, Daily #1 = 2025-01-01 UTC.
              </p>
            </div>
          </section>

          <section id="resolver" className="mt-12 scroll-mt-24">
            <h2 className="h3 mb-3">Resolver params</h2>
            <ParamTable
              rows={[
                ['type', 'image (default) or icon. Vector formats imply vector.'],
                ['format', 'svg · webp · png · jpg · pdf · eps · ai. Default: Accept negotiation (webp → png).'],
                ['size', 'N for width (e.g. 320) or WxH (e.g. 80x60). Default 320 image / 64 icon. Exact match → smallest ≥ → largest.'],
                ['download', '?download=1 sends Content-Disposition: attachment.'],
              ]}
            />
            <div className="mt-4">
              <CodeBlock
                title="resolver"
                tabs={[
                  { label: 'curl', code: `# exact width, explicit format\ncurl "/api/flags/jp?type=image&format=png&size=640" -o jp.png\n\n# icon for a favicon pipeline\ncurl "/api/flags/de?type=icon&size=64" -o de-64.webp\n\n# master download\ncurl "/api/flags/fr?format=pdf&download=1" -o fr.pdf` },
                  { label: 'HTML', code: `<!-- immutable, lazy, zero CLS with width/height -->\n<img src="/assets/v1/images/w320/jp.png"\n     width="320" height="213"\n     loading="lazy" decoding="async"\n     alt="Flag of Japan" />` },
                ]}
              />
            </div>
          </section>

          <section id="formats" className="mt-12 scroll-mt-24">
            <h2 className="h3 mb-3">Format guide</h2>
            <ParamTable
              rows={[
                ['SVG', 'Best default for vector consumers; infinitely scalable; gzipped on the wire.'],
                ['WebP', 'Preferred modern raster (25–40% smaller than PNG). Use Accept negotiation or ?format=webp.'],
                ['PNG', 'Compatibility + transparency fallback; predictable API default.'],
                ['JPG', 'Only on explicit request — flat flag colors compress poorly as JPEG.'],
                ['PDF / AI / EPS', 'Master downloads; Range-enabled; use ?download=1.'],
              ]}
            />
          </section>

          <section id="caching" className="mt-12 scroll-mt-24">
            <h2 className="h3 mb-3">Caching</h2>
            <CodeBlock
              title="cache headers"
              tabs={[
                {
                  label: 'Headers',
                  code: `/assets/v1/*        → public, max-age=31536000, immutable   (bump v1 to invalidate)\n/api/flags/*        → public, max-age=86400, stale-while-revalidate=604800 + Vary: Accept\n/api/v1/countries*  → public, max-age=3600, stale-while-revalidate=86400\nETag: "<size>-<mtimeNano>" · conditional requests → 304 · Range → 206`,
                },
              ]}
            />
            <div className="callout mt-4">
              <span className="callout-icon text-soft" aria-hidden>
                <Info size={17} />
              </span>
              <p>
                Because <code className="mono">/assets/v1/*</code> is immutable, set a far-future <code className="mono">Expires</code> in
                your CDN and never purge — a data refresh ships as a new version prefix.
              </p>
            </div>
          </section>

          <section id="errors" className="mt-12 scroll-mt-24">
            <h2 className="h3 mb-3">Errors</h2>
            <p className="body-scale mb-3 text-soft">JSON bodies with a machine-readable code, suitable for switch statements:</p>
            <CodeBlock
              title="errors"
              tabs={[
                {
                  label: 'JSON',
                  code: `{"error": {"code": "country_not_found", "message": "..."}}\n{"error": {"code": "invalid_format" | "invalid_type" | "invalid_size", "...": "..."}}\n{"error": {"code": "variant_not_found", "available_formats": [...], "available_sizes": [...]}}`,
                },
              ]}
            />
          </section>

          <section id="limits" className="mt-12 scroll-mt-24">
            <h2 className="h3 mb-3">Rate limits</h2>
            <p className="body-scale text-soft">
              Generous per-IP token bucket (default 200/min, burst 100). Exceeding it returns{' '}
              <code className="mono">429</code> with <code className="mono">Retry-After</code>. Static assets behind a CDN
              rarely trip the limiter — back off exponentially and retry.
            </p>
            <div className="callout callout-tip mt-4">
              <span className="callout-icon" aria-hidden>
                <Lightbulb size={17} />
              </span>
              <p>
                Building something interactive?{' '}
                <Link href="/playground" className="font-semibold text-primary hover:underline">
                  Open the playground
                </Link>{' '}
                to prototype resolver URLs with live timing before you ship.
              </p>
            </div>
          </section>
        </div>

        {/* right TOC */}
        <aside className="hidden xl:block">
          <div className="sticky top-[88px]">
            <p className="mono mb-2 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-soft">On this page</p>
            {tocList}
          </div>
        </aside>
      </div>

      <Sheet open={tocOpen} onClose={() => setTocOpen(false)} title="On this page">
        {tocList}
        <Link href="/playground" className="btn btn-primary mt-6 w-full" onClick={() => setTocOpen(false)}>
          <FlaskConical size={16} aria-hidden /> Open playground
        </Link>
      </Sheet>
    </div>
  );
}
