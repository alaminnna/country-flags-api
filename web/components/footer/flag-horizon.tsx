'use client';

import { useRef, useCallback, useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useHorizonCountries, useInView } from './horizon-data';
import { FlagTile } from './flag-tile';

const MAX_EXPAND = 48;
const BASE_W = 6;
const RADIUS = 6;

export function FlagHorizon() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const inView = useInView(wrapperRef, 600);
  const reduce = useReducedMotion();
  const countries = useHorizonCountries();
  const [mounted, setMounted] = useState(false);
  const raf = useRef(0);
  const mx = useRef(-1);

  useEffect(() => { if (inView) setMounted(true); }, [inView]);

  const onMove = useCallback((e: React.MouseEvent) => {
    if (reduce || !stripRef.current) return;
    mx.current = e.clientX;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const strip = stripRef.current;
      if (!strip) return;
      strip.querySelectorAll<HTMLAnchorElement>('.horizon-tile').forEach((tile) => {
        const rect = tile.getBoundingClientRect();
        const dist = Math.abs(mx.current - (rect.left + rect.width / 2));
        const inf = Math.max(0, 1 - dist / (BASE_W * RADIUS * 8));
        tile.style.width = `${BASE_W + (MAX_EXPAND - BASE_W) * inf}px`;
        tile.style.height = `${24 + 8 * inf}px`;
        tile.style.transform = `translateY(${-4 * inf}px)`;
      });
    });
  }, [reduce]);

  const onLeave = useCallback(() => {
    if (reduce || !stripRef.current) return;
    stripRef.current.querySelectorAll<HTMLAnchorElement>('.horizon-tile').forEach((t) => {
      t.style.width = ''; t.style.height = ''; t.style.transform = '';
    });
  }, [reduce]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const tiles = stripRef.current?.querySelectorAll<HTMLAnchorElement>('.horizon-tile');
    if (!tiles?.length) return;
    const idx = Array.from(tiles).indexOf(document.activeElement as HTMLAnchorElement);
    const next = e.key === 'ArrowRight' ? Math.min(idx + 1, tiles.length - 1) : Math.max(idx - 1, 0);
    tiles[next].focus();
  }, []);

  if (!mounted || countries.length === 0) {
    return <div ref={wrapperRef} className="horizon-strip" aria-hidden />;
  }

  return (
    <div ref={wrapperRef} className="horizon-wrapper">
      <div
        ref={stripRef}
        className="horizon-strip"
        role="list"
        aria-label="Browse all 254 country flags"
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        onKeyDown={onKeyDown}
      >
        {countries.map((c) => (
          <span key={c.code} role="listitem" className="horizon-tile-wrap">
            <FlagTile country={c} />
          </span>
        ))}
      </div>
    </div>
  );
}
