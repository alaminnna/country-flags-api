'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { flushSync } from 'react-dom';
import { useMounted } from '../lib/hooks';

type VTDocument = Document & {
  startViewTransition?: (cb: () => void) => { ready: Promise<void> };
};

/**
 * ThemeToggle — plain Light ↔ Dark switch.
 * First visit follows the OS (default: system); after the first manual
 * toggle the choice is explicit, so one click always does the obvious thing.
 * Circular reveal expanding from the toggle button via the View
 * Transitions API; graceful 250ms crossfade fallback where unsupported.
 */
export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const mounted = useMounted();
  const reduce = useReducedMotion();

  // fixed-size placeholder pre-hydration: zero FOUC, zero layout shift
  if (!mounted) return <span className="icon-btn" aria-hidden />;

  const isDark = (theme === 'system' ? resolvedTheme : theme) === 'dark';
  const next = isDark ? 'light' : 'dark';

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const x = e.clientX;
    const y = e.clientY;
    const doc = document as VTDocument;
    if (!doc.startViewTransition || reduce || x === 0) {
      setTheme(next);
      return;
    }
    const vt = doc.startViewTransition(() => {
      flushSync(() => setTheme(next));
    });
    vt.ready
      .then(() => {
        const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
          { duration: 450, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' },
        );
      })
      .catch(() => {});
  };

  return (
    <button
      type="button"
      className="icon-btn"
      onClick={onClick}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={next}
          initial={reduce ? { opacity: 0 } : { opacity: 0, rotate: -70, scale: 0.7 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, rotate: 70, scale: 0.7 }}
          transition={{ duration: 0.2 }}
          style={{ display: 'inline-flex' }}
        >
          {isDark ? <Sun size={19} /> : <Moon size={19} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
