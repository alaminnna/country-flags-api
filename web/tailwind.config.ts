import type { Config } from 'tailwindcss';

/**
 * All colors reference CSS custom properties defined in app/globals.css.
 * Tokens are the single source of truth — components never hardcode colors.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-muted': 'var(--surface-muted)',
        border: 'var(--border)',
        strong: 'var(--text-primary)',
        soft: 'var(--text-secondary)',
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
          subtle: 'var(--primary-subtle)',
        },
        ring: 'var(--ring)',
        'code-bg': 'var(--code-bg)',
        'code-fg': 'var(--code-fg)',
        destructive: 'var(--destructive)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        full: '9999px',
      },
      maxWidth: {
        page: '1200px',
        landing: '1280px',
        prose: '720px',
      },
      transitionTimingFunction: {
        'expo-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      transitionDuration: {
        fast: '150ms',
        base: '250ms',
        slow: '400ms',
      },
      keyframes: {
        shimmer: {
          to: { 'background-position': '-200% 0' },
        },
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        'marquee-rev': {
          from: { transform: 'translateX(-50%)' },
          to: { transform: 'translateX(0)' },
        },
        'toast-progress': {
          from: { transform: 'scaleX(1)' },
          to: { transform: 'scaleX(0)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.4s linear infinite',
        marquee: 'marquee 80s linear infinite',
        'marquee-rev': 'marquee-rev 92s linear infinite',
        'toast-progress': 'toast-progress 3s linear forwards',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-hover)',
        glow: 'var(--glow)',
      },
    },
  },
  plugins: [],
};

export default config;
