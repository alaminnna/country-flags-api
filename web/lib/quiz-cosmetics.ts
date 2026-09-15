'use client';

// Quiz cosmetics — PRESENTATION ONLY. Never touches scoring, seeds, storage schema.
// - Rank: derived from accuracy (S ≥95, A ≥80, B ≥60, C ≥40, else F).
// - Level/XP: derived from existing localStorage stats, never migrated.
//   XP = totalCorrect (1 XP per correct answer, all-time).
//   Level thresholds (cumulative XP): L1 0, L2 10, L3 30, L4 60, L5 100,
//   L6 150, L7 220, L8 300, L9 400, L10 550. Beyond L10: +200 XP per level.
//   These thresholds are cosmetic and documented here so design + code agree.

export type QuizRank = 'S' | 'A' | 'B' | 'C' | 'F';

export function rankForAccuracy(accPct: number): QuizRank {
  if (accPct >= 95) return 'S';
  if (accPct >= 80) return 'A';
  if (accPct >= 60) return 'B';
  if (accPct >= 40) return 'C';
  return 'F';
}

const LEVEL_STEPS = [0, 10, 30, 60, 100, 150, 220, 300, 400, 550];

export function levelForXP(xp: number): { level: number; cur: number; next: number; pct: number } {
  const x = Math.max(0, Math.floor(xp));
  for (let i = LEVEL_STEPS.length - 1; i >= 0; i--) {
    const cur = LEVEL_STEPS[i];
    let next: number;
    if (i + 1 < LEVEL_STEPS.length) next = LEVEL_STEPS[i + 1];
    else {
      // beyond L10: +200 per level
      const extra = Math.floor((x - cur) / 200);
      const lvl = 10 + extra;
      const base = cur + extra * 200;
      return { level: lvl, cur: base, next: base + 200, pct: Math.min(1, (x - base) / 200) };
    }
    if (x >= cur) {
      return { level: i + 1, cur, next, pct: Math.min(1, (x - cur) / Math.max(1, next - cur)) };
    }
  }
  return { level: 1, cur: 0, next: 10, pct: 0 };
}

/** UTC midnight countdown — returns h/m/s parts + label. Ticks each second via caller. */
export function countdownToNextDailyUTC(nowMs = Date.now()): { h: string; m: string; s: string; label: string } {
  const now = new Date(nowMs);
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0);
  let sec = Math.max(0, Math.floor((midnight - nowMs) / 1000));
  const h = Math.floor(sec / 3600);
  sec -= h * 3600;
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return { h: pad(h), m: pad(m), s: pad(s), label: `${pad(h)}:${pad(m)}:${pad(s)}` };
}

/** Streak flame stage 0–5 (purely cosmetic). */
export function flameStage(streak: number): number {
  if (streak >= 8) return 5;
  if (streak >= 5) return 4;
  if (streak >= 4) return 3;
  if (streak >= 3) return 2;
  if (streak >= 2) return 1;
  return 0;
}
