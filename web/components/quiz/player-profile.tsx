'use client';

import { useMemo } from 'react';
import { levelForXP } from '../../lib/quiz-cosmetics';

/**
 * Player profile — client-side cosmetic, derived from existing localStorage stats.
 * XP = totalCorrect. Level thresholds documented in lib/quiz-cosmetics.ts.
 * NO changes to stored schema — derive, don't migrate.
 */
export function LevelRing({ xp, size = 44 }: { xp: number; size?: number }) {
  const lv = levelForXP(xp);
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="q-lvring" role="img" aria-label={`Level ${lv.level}, ${Math.round(lv.pct * 100)} percent to next`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={5} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - lv.pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <b className="mono">Lv&nbsp;{lv.level}</b>
    </span>
  );
}

export function XpBar({ xp }: { xp: number }) {
  const lv = useMemo(() => levelForXP(xp), [xp]);
  const remain = lv.next - xp;
  return (
    <span className="q-xpbar" role="img" aria-label={`${xp} XP, ${remain} to level ${lv.level + 1}`}>
      <span className="q-xptrack" aria-hidden>
        <span style={{ transform: `scaleX(${lv.pct})` }} />
      </span>
      <span className="mono q-xplabel">
        {xp.toLocaleString('en-US')} XP · {remain} to Lv {lv.level + 1}
      </span>
    </span>
  );
}
