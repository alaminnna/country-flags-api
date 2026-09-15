'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { Brain, Compass, FlaskConical, GitCompareArrows, Home, ScrollText } from 'lucide-react';
import { SPRING_MICRO } from '../lib/motion';

const TABS = [
  { label: 'Home', href: '/', Icon: Home },
  { label: 'Explore', href: '/explore', Icon: Compass },
  { label: 'Quiz', href: '/quiz', Icon: Brain },
  { label: 'Compare', href: '/compare', Icon: GitCompareArrows },
  { label: 'Playground', href: '/playground', Icon: FlaskConical },
  { label: 'Docs', href: '/docs', Icon: ScrollText },
];

function isActive(pathname: string, href: string): boolean {
  // trailingSlash:true serves /explore/ — normalize before comparing
  const p = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  if (href === '/') return p === '/';
  if (href === '/explore') return p === '/explore' || p.startsWith('/country');
  return p === href || p.startsWith(`${href}/`);
}

/**
 * TabBar — simple modern floating tab bar (mobile-principles applied):
 * - bottom EASY thumb zone, always reachable (never hides mid-task)
 * - 5 equal tabs, every target 52px+ tall (platform min is 44/48)
 * - active state is a visible sliding spring pill, press feedback on tap
 * - env(safe-area-inset-bottom) respected for home-indicator devices
 */
export function TabBar() {
  const pathname = usePathname() ?? '';
  const reduce = useReducedMotion();

  return (
    <nav className="tabbar lg:hidden" aria-label="Primary">
      <div className="tabbar-inner">
        {TABS.map((t) => {
          const active = isActive(pathname, t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`tabbar-item ${active ? 'is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              {active &&
                (reduce ? (
                  <span className="tabbar-pill" aria-hidden />
                ) : (
                  <motion.span layoutId="tabbar-pill" className="tabbar-pill" transition={SPRING_MICRO} aria-hidden />
                ))}
              <t.Icon size={22} aria-hidden className="relative z-[1]" />
              <span className="sr-only">{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
