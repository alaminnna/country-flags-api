'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import { Country } from '../lib/api';
import { highlightSegments } from '../lib/countries';
import { useIsMobile } from '../lib/hooks';
import { useToast } from './toast';
import { FlagImage } from './flag-image';
import { CopyButton } from './copy-button';
import { Chip } from './ui';
import { Sheet } from './sheet';

function Highlighted({ label, query }: { label: string; query: string }) {
  const nq = query.trim().toLowerCase();
  if (!nq) return <>{label}</>;
  return (
    <>
      {highlightSegments(label, nq).map((s, i) =>
        s.hit ? (
          <mark key={i} className="search-hit">
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

/**
 * FlagCard — desktop: lift 4px + shadow + 3D tilt toward cursor (max 6°,
 * perspective 800) + quick actions fade in. Mobile: plain press scale.
 * Quick actions are siblings of the link (valid HTML, no nested buttons).
 */
export function FlagCard({
  country,
  query = '',
  eager = false,
  showRegion = false,
  format = 'png',
}: {
  country: Country;
  query?: string;
  eager?: boolean;
  showRegion?: boolean;
  /** grid preview format — svg renders the vector master */
  format?: 'png' | 'webp' | 'svg';
}) {
  const reduce = useReducedMotion();
  const isMobile = useIsMobile();
  const rootRef = useRef<HTMLDivElement>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const longPressFired = useRef(false);
  const { push } = useToast();

  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
    pressOrigin.current = null;
  };

  // long-press (touch only) = quick-copy URL sheet + haptic-style pulse
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    pressOrigin.current = { x: t.clientX, y: t.clientY };
    pressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      try {
        navigator.vibrate?.(10);
      } catch {
        /* noop */
      }
      setSheetOpen(true);
    }, 450);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const o = pressOrigin.current;
    if (!o) return;
    const t = e.touches[0];
    if (Math.hypot(t.clientX - o.x, t.clientY - o.y) > 10) cancelPress();
  };

  const onMove = (e: React.PointerEvent) => {
    if (reduce || isMobile || e.pointerType === 'touch') return;
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(800px) rotateX(${(-py * 6).toFixed(2)}deg) rotateY(${(px * 6).toFixed(
      2,
    )}deg) translateY(-4px)`;
  };

  const onLeave = () => {
    const el = rootRef.current;
    if (el) el.style.transform = '';
  };

  return (
    <div
      ref={rootRef}
      className="flag-card select-none"
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={cancelPress}
      onTouchCancel={cancelPress}
      onContextMenu={(e) => {
        if (window.matchMedia('(pointer: coarse)').matches) e.preventDefault();
      }}
      style={isMobile ? undefined : { transition: 'transform 250ms cubic-bezier(0.16,1,0.3,1)' }}
    >
      <Link
        href={`/country/${country.code}`}
        className="flex min-w-0 flex-col text-inherit no-underline"
        aria-label={`${country.name} — view details`}
        onClick={(e) => {
          // swallow the tap that ends a long-press
          if (longPressFired.current) {
            e.preventDefault();
            longPressFired.current = false;
          }
        }}
      >
        <FlagImage
          code={country.code}
          name={country.name}
          eager={eager}
          size="w320"
          format={format === 'svg' ? 'svg' : format}
          type={format === 'svg' ? 'vector' : 'image'}
        />
        <div className="flag-name">
          <Highlighted label={country.name} query={query} />
        </div>
        <div className="flag-meta">
          <Chip variant="iso">{country.code}</Chip>
          {showRegion && country.meta?.continent && (
            <span className="small-scale truncate text-soft">{country.meta.continent}</span>
          )}
        </div>
      </Link>
      <div className="flag-card-actions">
        <CopyButton text={`/assets/v1/images/w320/${country.code}.png`} label="Copy flag URL" />
        <Link
          href={`/country/${country.code}`}
          className="flag-card-action"
          aria-label={`View ${country.name}`}
          tabIndex={-1}
        >
          <ArrowUpRight size={16} />
        </Link>
      </div>
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={`Quick copy — ${country.name}`}>
        <div className="flex flex-col gap-2 pb-2">
          {[
            { label: 'PNG · 320px', text: `/assets/v1/images/w320/${country.code}.png` },
            { label: 'WebP · 320px', text: `/assets/v1/images/w320/${country.code}.webp` },
            { label: 'SVG · vector', text: `/assets/v1/vectors/svg/${country.code}.svg` },
            { label: 'Metadata API', text: `/api/v1/countries/${country.code}` },
          ].map((row) => (
            <div key={row.label} className="asset-row">
              <span className="min-w-0 flex-1">
                <span className="block text-[0.85rem] font-semibold">{row.label}</span>
                <span className="url-clip mt-1 block">{row.text}</span>
              </span>
              <CopyButton text={row.text} label={`Copy ${row.label}`} showLabel onCopied={() => push(`${row.label} copied`)} />
            </div>
          ))}
          <Link
            href={`/country/${country.code}`}
            className="btn btn-primary mt-2 w-full"
            onClick={() => setSheetOpen(false)}
          >
            View details
          </Link>
        </div>
      </Sheet>
    </div>
  );
}
