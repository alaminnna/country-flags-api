import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Boxes, Compass, Database, FileLock2, FlaskConical, Gauge, Globe, ScrollText, Zap } from 'lucide-react';
import { Chip } from '../../components/ui';
import { DeveloperAvatar } from '../../components/developer-avatar';
import { GithubIcon, LinkedinIcon } from '../../components/brand-icons';

export const metadata: Metadata = {
  title: 'About',
  description:
    'What Flags API is and how it works: one Go binary serving 254 countries of flag metadata, a smart resolver, and immutable versioned assets with zero-copy delivery.',
  keywords: ['flags api about', 'how flags api works', 'flags api architecture', 'go flags server'],
  openGraph: {
    title: 'About — Flags API',
    description: 'How Flags API works: one Go binary, 254 countries, zero-copy delivery, immutable caching.',
    url: 'https://country-flags-api.vercel.app/about',
  },
  twitter: {
    title: 'About — Flags API',
    description: 'How Flags API works: one Go binary, 254 countries, zero-copy delivery, immutable caching.',
  },
  alternates: { canonical: 'https://country-flags-api.vercel.app/about' },
};

const PILLARS = [
  {
    Icon: Database,
    title: 'Metadata API',
    body: 'One JSON record per country — capital, continent, population, area, currency, calling code, neighbours and more. ISO2, ISO3 and numeric codes all resolve, any case.',
  },
  {
    Icon: Zap,
    title: 'Smart resolver',
    body: '/api/flags/{code} picks the best variant from ?type=, ?format= and ?size=. Skip ?format= and it negotiates from your Accept header — WebP for modern browsers, PNG everywhere else.',
  },
  {
    Icon: FileLock2,
    title: 'Immutable files',
    body: 'Every file lives under /assets/v1/ with max-age=31536000, immutable. ETag + conditional requests give you 304s, Range gives you 206s. New data ships as a new version, never a purge.',
  },
];

const NUMBERS: [string, string][] = [
  ['254', 'countries'],
  ['7', 'formats'],
  ['26k+', 'versioned files'],
  ['1', 'Go binary'],
];

const OPS: [string, string][] = [
  ['Zero-copy', 'sendfile straight from disk to socket — no app-server copies, no database in the hot path.'],
  ['Honest errors', 'machine-readable codes: country_not_found, invalid_format, variant_not_found with available_* hints.'],
  ['Fair limits', 'per-IP token bucket (200/min, burst 100). Over it? 429 with Retry-After, never a silent drop.'],
  ['Observable', '/healthz and /readyz for orchestrators, sampled request logs, localhost pprof.'],
];

/** About — what the platform is and how it works. Static, zero client JS. */
export default function About() {
  return (
    <div className="page-shell pt-8 lg:pt-12">
      <div className="max-w-prose">
        <p className="mono mb-2 text-[0.72rem] font-bold uppercase tracking-[0.12em] text-primary">About</p>
        <h1 className="h2">One binary. Every flag.</h1>
        <p className="body-scale mt-3 text-soft">
          Flags API is a self-hosted country-flags and metadata platform. A single Go binary serves JSON metadata, resolves
          the best flag variant per request, and delivers versioned asset files with zero-copy sendfile. No database, no Node
          in production, CORS open.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/explore" className="btn btn-primary">
            Explore all countries <ArrowRight size={16} aria-hidden />
          </Link>
          <Link href="/docs" className="btn btn-secondary">
            <ScrollText size={16} aria-hidden /> API docs
          </Link>
          <Link href="/playground" className="btn btn-ghost">
            <FlaskConical size={16} aria-hidden /> Playground
          </Link>
        </div>
      </div>

      {/* author spotlight — Al A Min (Alaminnna) */}
      <section className="spotlight mt-10" aria-label="Author">
        <div className="spotlight-inner flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:p-8">
          <DeveloperAvatar src="https://github.com/alaminnna.png" name="Al A Min (Alaminnna)" size={112} />
          <div className="min-w-0">
            <p className="mono mb-2 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-primary">Author</p>
            <p className="flex flex-wrap items-center gap-2">
              <span className="text-[1.35rem] font-extrabold tracking-tight">Al A Min</span>
              <Chip variant="iso">@alaminnna</Chip>
            </p>
            <p className="body-scale mt-2 max-w-prose text-soft">
              AI Developer and Full Stack Web Developer based in Dhaka, Bangladesh. Designs, builds and maintains Flags API.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {['AI Developer', 'Full Stack Web Developer', 'Student', 'Entrepreneur', 'Open Source Builder'].map((r) => (
                <Chip key={r}>{r}</Chip>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href="https://alaminnna.ami.bd" target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                <Globe size={14} aria-hidden /> Website
              </a>
              <a href="https://github.com/alaminnna" target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                <GithubIcon size={14} /> GitHub
              </a>
              <a href="https://www.linkedin.com/in/alaminnna/" target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                <LinkedinIcon size={14} /> LinkedIn
              </a>
            </div>
          </div>
        </div>
      </section>

      <div className="card mt-10 grid grid-cols-2 gap-8 px-6 py-8 sm:grid-cols-4">
        {NUMBERS.map(([v, label]) => (
          <div key={label} className="flex flex-col items-center gap-1 text-center">
            <span className="stat-num text-[clamp(1.75rem,1.4rem+1.6vw,2.5rem)]">{v}</span>
            <span className="small-scale font-semibold uppercase tracking-[0.08em] text-soft">{label}</span>
          </div>
        ))}
      </div>

      <section className="mt-14" aria-label="How it works">
        <h2 className="h3 mb-5">How it works</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {PILLARS.map((p) => (
            <article key={p.title} className="feature-card">
              <span className="feature-icon" aria-hidden>
                <p.Icon size={20} />
              </span>
              <h3 className="text-[1.02rem] font-bold tracking-tight">{p.title}</h3>
              <p className="body-scale mt-2 text-soft">{p.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-14" aria-label="Operations">
        <h2 className="h3 mb-5">Built to run and forget</h2>
        <div className="card divide-y divide-border overflow-hidden">
          {OPS.map(([k, v]) => (
            <div key={k} className="grid gap-1 px-5 py-4 sm:grid-cols-[180px_1fr] sm:gap-4">
              <p className="text-[0.9rem] font-bold">{k}</p>
              <p className="body-scale text-soft">{v}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14" aria-label="Formats">
        <h2 className="h3 mb-3">Formats, served sensibly</h2>
        <p className="body-scale max-w-prose text-soft">
          SVG for vector consumers, WebP as the modern raster default, PNG for compatibility, JPG only on explicit request —
          plus PDF, AI and EPS masters with <span className="mono text-[0.85em]">?download=1</span>. The full matrix per country
          lives on every country page.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/country/bd" className="chip transition-colors hover:border-primary hover:text-primary">
            <Boxes size={13} aria-hidden /> Example: Bangladesh asset matrix
          </Link>
          <Link href="/compare" className="chip transition-colors hover:border-primary hover:text-primary">
            <Gauge size={13} aria-hidden /> Compare countries
          </Link>
          <Link href="/explore" className="chip transition-colors hover:border-primary hover:text-primary">
            <Compass size={13} aria-hidden /> Browse all 254
          </Link>
        </div>
      </section>

      {/* studio credit — Almoo Studio brand block */}
      <section className="studio-banner mt-14 p-7 sm:p-10" aria-label="Built by Almoo Studio">
        <p className="studio-label">Built by · Almoo Studio</p>
        <h2 className="studio-headline mt-3 max-w-xl text-[clamp(1.6rem,1.3rem+1.6vw,2.4rem)] font-extrabold leading-[1.1]">
          Designed and engineered by Almoo Studio.
        </h2>
        <p className="studio-sub body-scale mt-3 max-w-prose">
          Web • App • Digital Growth — Dhaka, estd. 2024. We Build. You Grow.
        </p>
        <p className="mt-6">
          <a href="https://almoo.pro.bd/" target="_blank" rel="noreferrer" className="studio-btn">
            almoo.pro.bd <ArrowUpRight size={15} aria-hidden />
          </a>
        </p>
      </section>
    </div>
  );
}
