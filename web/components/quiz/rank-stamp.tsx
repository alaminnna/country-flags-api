'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { EASE_EXPO } from '../../lib/motion';
import type { QuizRank } from '../../lib/quiz-cosmetics';

/**
 * Rank stamp — passport-stamp entrance: scale 2→1 + rotate -6°→0° + blur→sharp, 450ms.
 * S/A brand green, B neutral, C muted, F desaturated red. Token-only colors.
 */
export function RankStamp({ rank }: { rank: QuizRank }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      className={`q-rank is-${rank}`}
      role="img"
      aria-label={`Rank ${rank}`}
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 2, rotate: -6, filter: 'blur(6px)' }}
      animate={{ opacity: 1, scale: 1, rotate: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.45, ease: EASE_EXPO }}
    >
      {rank}
      <span className="q-dust" aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.i
            key={i}
            initial={reduce ? { opacity: 0 } : { opacity: 0.9, x: 0, y: 0, scale: 1 }}
            animate={{ opacity: 0, x: (i - 2.5) * 14, y: -10 - (i % 3) * 8, scale: 0.3 }}
            transition={{ duration: 0.5, delay: 0.3, ease: EASE_EXPO }}
          />
        ))}
      </span>
    </motion.span>
  );
}

export function AccuracyRing({ pct, size = 76 }: { pct: number; size?: number }) {
  const reduce = useReducedMotion();
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const target = c * (1 - Math.min(1, Math.max(0, pct / 100)));
  const C = motion.circle;
  return (
    <span className="q-accring" role="img" aria-label={`${Math.round(pct)} percent accuracy`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={7} />
        <C
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={reduce ? { strokeDashoffset: target } : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: target }}
          transition={{ duration: 1.1, ease: EASE_EXPO }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <b className="mono">{Math.round(pct)}%</b>
    </span>
  );
}
