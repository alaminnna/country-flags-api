'use client';

// Mode identities — small inline SVG illustrations + micro-motifs.
// currentColor + one green accent (var(--primary)). NO emoji as identity.

export type ModeId = 'flag-to-country' | 'country-to-flag' | 'flag-to-capital' | 'flag-to-region' | 'mixed';

export const MODE_META: Record<ModeId, { name: string; blurb: string }> = {
  'flag-to-country': { name: 'Flag → Country', blurb: 'See a flag, name the country.' },
  'country-to-flag': { name: 'Country → Flag', blurb: 'Read the name, spot its flag.' },
  'flag-to-capital': { name: 'Flag → Capital', blurb: 'See a flag, pick the capital.' },
  'flag-to-region': { name: 'Flag → Region', blurb: 'See a flag, pick the continent.' },
  mixed: { name: 'Mixed', blurb: 'Shuffled mix of all four.' },
};

export function ModeGlyph({ mode, size = 22 }: { mode: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  } as const;
  const accent = 'var(--primary)';
  switch (mode) {
    case 'flag-to-country':
      // specimen card frame
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="13" rx="2.5" />
          <path d="M3 9.5h18" stroke={accent} />
          <circle cx="8" cy="6.8" r="0.9" fill={accent} stroke="none" />
          <path d="M6 20h12" stroke={accent} />
        </svg>
      );
    case 'country-to-flag':
      // 2×2 mosaic
      return (
        <svg {...common}>
          <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.8" />
          <rect x="13" y="3.5" width="7.5" height="7.5" rx="1.8" stroke={accent} />
          <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.8" stroke={accent} />
          <rect x="13" y="13" width="7.5" height="7.5" rx="1.8" />
        </svg>
      );
    case 'flag-to-capital':
      // passport-stamp ring
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.2" strokeDasharray="3 2.2" />
          <circle cx="12" cy="12" r="4.6" stroke={accent} />
          <path d="M12 10v4M10 12h4" stroke={accent} />
        </svg>
      );
    case 'flag-to-region':
      // compass rose
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.2" />
          <path d="M15.5 8.5l-2.2 4.8-4.8 2.2 2.2-4.8z" stroke={accent} fill="none" />
          <circle cx="12" cy="12" r="0.9" fill={accent} stroke="none" />
        </svg>
      );
    default:
      // shuffle glyph
      return (
        <svg {...common}>
          <path d="M3 7h4l10 10h4" />
          <path d="M3 17h4l2.2-2.2M13.8 9.2L17 7h4" stroke={accent} />
          <path d="M18 4.5L20.5 7 18 9.5M18 14.5l2.5 2.5L18 19.5" stroke={accent} />
        </svg>
      );
  }
}
