'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Flame } from 'lucide-react';
import { EASE_EXPO } from '../../lib/motion';
import { flameStage } from '../../lib/quiz-cosmetics';

/* ── Streak flame: emerald glyph, 5 growth stages (scale + inner glow) ── */

export function StreakFlame({ streak, size = 15 }: { streak: number; size?: number }) {
  const stage = flameStage(streak);
  if (stage === 0) return null;
  const scale = [0, 0.9, 1, 1.12, 1.22, 1.34][stage];
  const glow = [0, 0, 2, 5, 8, 12][stage];
  return (
    <span
      className="q-flame"
      data-stage={stage}
      role="img"
      aria-label={`${streak} streak`}
      style={{ transform: `scale(${scale})`, filter: glow ? `drop-shadow(0 0 ${glow}px rgba(52,211,153,0.55))` : 'none' }}
    >
      <Flame size={size} aria-hidden strokeWidth={2.2} />
      <b className="mono">{streak}</b>
    </span>
  );
}

/* ── Difficulty meter: 4-step leaf glyph meter ── */

const DIFF_ORDER = ['easy', 'medium', 'hard', 'expert'];

export function DifficultyMeter({ difficulty, size = 13 }: { difficulty: string; size?: number }) {
  const filled = Math.max(1, DIFF_ORDER.indexOf(difficulty.toLowerCase()) + 1);
  return (
    <span className="q-leaves" role="img" aria-label={`Difficulty ${difficulty}: ${filled} of 4`} title={difficulty}>
      {[1, 2, 3, 4].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden className={i <= filled ? 'is-on' : ''}>
          <path
            d="M12 3C7 8 5 12 5 15a7 7 0 0 0 14 0c0-3-2-7-7-12z"
            fill={i <= filled ? 'var(--primary)' : 'none'}
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          {i <= filled && <path d="M12 8v9" stroke="var(--surface)" strokeWidth="1.4" strokeLinecap="round" />}
        </svg>
      ))}
    </span>
  );
}

/* ── Segmented progress pills: one per question ── */

export function ProgressPills({
  total,
  index,
  results,
}: {
  total: number;
  index: number;
  results: boolean[];
}) {
  return (
    <div className="q-pills" role="img" aria-label={`Question ${Math.min(index + 1, total)} of ${total}`}>
      {Array.from({ length: total }).map((_, i) => {
        const done = i < results.length;
        const cls = done ? (results[i] ? 'is-ok' : 'is-bad') : i === index ? 'is-cur' : '';
        return <span key={i} className={`q-pill ${cls}`} aria-hidden />;
      })}
    </div>
  );
}

/* ── Timer arc: thin arc under the stage frame draining over 15s ── */

export function TimerArc({ frac, size = 0 }: { frac: number; size?: number }) {
  void size;
  // frac: 0 → 1 elapsed. remaining = 1 - frac
  const remain = Math.max(0, Math.min(1, 1 - frac));
  const secsLeft = Math.ceil(remain * 15);
  const phase = secsLeft <= 3 ? 'is-red' : secsLeft <= 8 ? 'is-amber' : 'is-ok';
  return (
    <div className={`q-arc ${phase}`} aria-hidden>
      <span style={{ transform: `scaleX(${remain})` }} />
    </div>
  );
}

/* ── Score chip with +N float ── */

export function ScoreChip({ score, floatPts, floatKey }: { score: number; floatPts: number | null; floatKey: number }) {
  const reduce = useReducedMotion();
  return (
    <span className="q-scorewrap">
      <span className="q-score mono" aria-live="polite" aria-label={`Score ${score}`}>
        {score.toLocaleString('en-US')}
      </span>
      {floatPts !== null && floatPts > 0 && (
        <motion.span
          key={floatKey}
          className="q-float mono"
          aria-hidden
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: [0, 1, 1, 0], y: -18 }}
          transition={{ duration: 0.7, ease: EASE_EXPO }}
        >
          +{floatPts}
        </motion.span>
      )}
    </span>
  );
}

/* ── Spark burst: 8–12 tiny green sparks, transform-only, DOM-removed after 500ms ── */

export function SparkBurst({ burstKey, n = 10 }: { burstKey: number; n?: number }) {
  const reduce = useReducedMotion();
  const parts = useMemo(
    () =>
      Array.from({ length: n }).map((_, i) => {
        const a = (i / n) * Math.PI * 2 + 0.3;
        return { x: Math.cos(a) * (26 + (i % 3) * 12), y: Math.sin(a) * (26 + ((i + 1) % 3) * 10) };
      }),
    [n],
  );
  if (burstKey === 0 || reduce) return null;
  return (
    <span key={burstKey} className="q-sparks" aria-hidden>
      {parts.map((p, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
          animate={{ opacity: 0, x: p.x, y: p.y, scale: 0.4 }}
          transition={{ duration: 0.5, ease: EASE_EXPO }}
          onAnimationComplete={() => undefined}
        />
      ))}
    </span>
  );
}

/* ── Live UTC-midnight countdown ticker ── */

export function useNowTick(active = true, ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [active, ms]);
  return now;
}

export function useSparkLifecycle(milestoneKey: number): boolean {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!milestoneKey) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 550);
    return () => clearTimeout(t);
  }, [milestoneKey]);
  return show;
}

export const __chromeId = () => useId();
