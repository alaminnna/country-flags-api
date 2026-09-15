'use client';

import { useEffect, useRef, useState } from 'react';
import { flagUrl } from '../lib/api';

/**
 * FlagImage — blur-up flag rendering with zero CLS.
 * Fixed aspect-ratio box + green-tinted shimmer → fades in on onLoad.
 * Plain <img> on immutable /assets/v1/ URLs (static-export safe).
 */
export function FlagImage({
  code,
  name,
  size = 'w320',
  format = 'png',
  type = 'image',
  aspect = '3 / 2',
  eager = false,
  className = '',
  alt,
  fit = 'cover',
}: {
  code: string;
  name: string;
  size?: string;
  format?: string;
  type?: 'image' | 'icon' | 'vector';
  aspect?: string;
  eager?: boolean;
  className?: string;
  alt?: string;
  /** cover fills the frame edge-to-edge (grids); contain shows the whole flag (detail views) */
  fit?: 'cover' | 'contain';
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [fallbackSrc, setFallbackSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const src = fallbackSrc ?? flagUrl(code, { size, format, type });

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    setFallbackSrc(null);
    // cached images may finish before hydration attaches onLoad —
    // without this check they would stay invisible forever
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) setLoaded(true);
  }, [src, code, size, format, type]);

  const onError = () => {
    // One automatic fallback: webp/jpg → png (most compatible). If that
    // also fails (429, 404, offline), show the ISO chip instead of an
    // endless shimmer so the grid never looks broken while scrolling.
    if (!fallbackSrc && format !== 'png' && type !== 'vector') {
      setFallbackSrc(flagUrl(code, { size, format: 'png', type }));
      return;
    }
    setFailed(true);
  };

  if (failed) {
    return (
      <div
        className={`flag-frame ${className}`.trim()}
        style={{ aspectRatio: aspect }}
        role="img"
        aria-label={`Flag of ${name} (unavailable offline)`}
      >
        <span className="flex h-full w-full items-center justify-center" style={{ background: 'var(--surface-muted)' }}>
          <span className="chip chip-iso">{code}</span>
        </span>
      </div>
    );
  }

  return (
    <div className={`flag-frame ${loaded ? '' : 'is-loading'} ${className}`.trim()} style={{ aspectRatio: aspect }}>
      <img
        ref={imgRef}
        src={src}
        alt={alt ?? `Flag of ${name}`}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={onError}
        className={loaded ? 'is-loaded' : ''}
        style={fit === 'contain' ? { objectFit: 'contain' } : undefined}
      />
    </div>
  );
}
