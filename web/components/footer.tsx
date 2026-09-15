import Link from 'next/link';
import { Flag } from 'lucide-react';
import { FlagHorizon } from './footer/flag-horizon';
import { StatusPill } from './footer/status-pill';
import { DailyCard } from './footer/daily-card';
import { SurpriseMe } from './footer/surprise-me';
import { BottomBar } from './footer/bottom-bar';

const EXPLORE_LINKS = [
  { label: 'Explore all countries', href: '/explore' },
  { label: 'Compare', href: '/compare' },
  { label: 'Flag Quiz', href: '/quiz' },
  { label: 'Daily Challenge', href: '/quiz/play?daily=1' },
];

const DEV_LINKS = [
  { label: 'API Docs', href: '/docs' },
  { label: 'Playground', href: '/playground' },
  { label: 'Health endpoint', href: '/healthz' },
  { label: 'GitHub', href: 'https://github.com/fivexl/flags-api', external: true },
  { label: 'Status', href: '/healthz' },
];

export function Footer() {
  return (
    <footer className="site-footer">
      <FlagHorizon />

      <div className="footer-grid">
        <div className="footer-brand">
          <Link href="/" className="brand" aria-label="Flags API home">
            <span className="brand-mark" aria-hidden>
              <Flag size={16} strokeWidth={2.5} />
            </span>
            Flags API
          </Link>
          <p className="footer-tagline">The flag API for developers.</p>
          <StatusPill />
        </div>

        <nav className="footer-col" aria-label="Explore">
          <p className="footer-heading">Explore</p>
          {EXPLORE_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="footer-link">{l.label}</Link>
          ))}
        </nav>

        <nav className="footer-col" aria-label="Developers">
          <p className="footer-heading">Developers</p>
          {DEV_LINKS.map((l) =>
            l.external ? (
              <a key={l.href} href={l.href} className="footer-link" target="_blank" rel="noreferrer">{l.label}</a>
            ) : (
              <Link key={l.href} href={l.href} className="footer-link">{l.label}</Link>
            )
          )}
        </nav>

        <div className="footer-today">
          <p className="footer-heading">Today</p>
          <DailyCard />
          <SurpriseMe />
        </div>
      </div>

      <BottomBar />
    </footer>
  );
}
