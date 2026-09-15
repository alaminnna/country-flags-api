'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { Flag, Search } from 'lucide-react';
import { useScrolled, useScrollDirection } from '../lib/hooks';
import { SPRING_MICRO } from '../lib/motion';
import { ThemeToggle } from './theme-toggle';
import { openCommandPalette } from './command-palette';
import { GithubIcon } from './brand-icons';
import { Kbd } from './ui';

const LINKS = [
  { label: 'Explore', href: '/explore' },
  { label: 'Quiz', href: '/quiz' },
  { label: 'Compare', href: '/compare' },
  { label: 'API Docs', href: '/docs' },
  { label: 'Playground', href: '/playground' },
  { label: 'About', href: '/about' },
];

function isActive(pathname: string, href: string): boolean {
  // trailingSlash:true serves /explore/ — normalize before comparing
  const p = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  if (href === '/explore') return p === '/explore' || p.startsWith('/country');
  return p === href || p.startsWith(`${href}/`);
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className={`brand ${compact ? 'text-[0.95rem]' : ''}`} aria-label="Flags API home">
      <span className="brand-mark" aria-hidden>
        <Flag size={compact ? 14 : 16} strokeWidth={2.5} />
      </span>
      Flags API
    </Link>
  );
}

/**
 * SiteNav — desktop: sticky 64px nav, transparent → glassmorphism after
 * 8px scroll, sliding active pill. Mobile: compact 56px bar.
 */
export function SiteNav() {
  const pathname = usePathname();
  const scrolled = useScrolled(8);
  const dir = useScrollDirection();
  const reduce = useReducedMotion();
  const topbarHidden = dir === 'down' && !reduce;

  // mobile sticky elements (explore search, tab rows) offset from this var,
  // so they glide to the top when the bar hides instead of leaving a gap
  useEffect(() => {
    document.documentElement.style.setProperty('--m-topbar', topbarHidden ? '0px' : '56px');
  }, [topbarHidden]);

  return (
    <>
      <header className={`nav hidden lg:block ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="nav-inner">
          <Brand />
          <nav className="nav-links" aria-label="Primary">
            {LINKS.map((l) => {
              const active = isActive(pathname ?? '', l.href);
              return (
                <Link key={l.href} href={l.href} className={`nav-link ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined}>
                  {active && <motion.span layoutId="nav-pill" className="nav-pill" transition={SPRING_MICRO} aria-hidden />}
                  <span className="relative z-[1]">{l.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-1.5">
            <button type="button" className="search-pill" onClick={openCommandPalette} aria-label="Search — Command K">
              <Search size={15} aria-hidden />
              <span>Search…</span>
              <span className="kbd-row" aria-hidden>
                <Kbd>⌘</Kbd>
                <Kbd>K</Kbd>
              </span>
            </button>
            <ThemeToggle />
            <a className="icon-btn" href="https://github.com" target="_blank" rel="noreferrer" aria-label="GitHub repository">
              <GithubIcon size={19} />
            </a>
          </div>
        </div>
      </header>

      <div className={`m-topbar lg:hidden ${topbarHidden ? 'is-hidden' : ''}`}>
        <Brand compact />
        <div className="ml-auto flex items-center">
          <button type="button" className="icon-btn" onClick={openCommandPalette} aria-label="Search">
            <Search size={19} />
          </button>
          <ThemeToggle />
        </div>
      </div>
    </>
  );
}
