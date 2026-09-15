import type { Variants } from 'framer-motion';

/**
 * Motion tokens — the ONLY easing/duration/spring values used in the app.
 * Durations: fast 150ms, base 250ms, slow 400ms.
 * Only transform + opacity are ever animated.
 */

export const EASE_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const DUR = { fast: 0.15, base: 0.25, slow: 0.4 } as const;

/** micro-interactions (press, toggles) */
export const SPRING_MICRO = { type: 'spring', stiffness: 300, damping: 30 } as const;

/** layout / FLIP animations (grids, sliders) */
export const SPRING_LAYOUT = { type: 'spring', stiffness: 200, damping: 25 } as const;

/** 40ms stagger between grid items */
export const STAGGER = 0.04;

/** page transitions: 250ms fade + 8px rise */
export const pageTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 0 },
  transition: { duration: DUR.base, ease: EASE_EXPO },
};

/** grid entrance: staggered 40ms fade-up, once */
export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: STAGGER } },
};

export const fadeUpChild: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: DUR.base, ease: EASE_EXPO },
  },
};

/** instant-only variants used when prefers-reduced-motion is on */
export const fadeOnlyChild: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.01 } },
};
