'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { animate, useInView, useReducedMotion } from 'framer-motion';
import { EASE_EXPO } from '../lib/motion';

/**
 * Stat — count-up number when scrolled into view (once).
 * Mono numbers, green accent. Instant value under reduced motion.
 */
export function Stat({
  value,
  label,
  format,
  decimals = 0,
}: {
  value: number;
  label: string;
  format?: (n: number) => string;
  decimals?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduce = useReducedMotion();
  // stable identity: a fresh closure every render would restart the count-up loop (visible glitch)
  const fmt = useMemo(
    () =>
      format ??
      ((n: number) =>
        n.toLocaleString('en-US', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })),
    [format, decimals],
  );
  const [display, setDisplay] = useState(() => fmt(0));

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setDisplay(fmt(value));
      return;
    }
    const controls = animate(0, value, {
      duration: 1.4,
      ease: EASE_EXPO,
      onUpdate: (v) => setDisplay(fmt(v)),
    });
    return () => controls.stop();
  }, [inView, value, reduce, fmt]);

  return (
    <div ref={ref} className="flex flex-col items-center gap-1 text-center">
      <span className="stat-num text-[clamp(1.75rem,1.4rem+1.6vw,2.5rem)]" aria-label={`${fmt(value)} ${label}`}>
        {display}
      </span>
      <span className="small-scale font-semibold uppercase tracking-[0.08em] text-soft">{label}</span>
    </div>
  );
}
