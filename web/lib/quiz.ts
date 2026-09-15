'use client';

// Quiz client: fetch helpers + IDENTICAL scoring + versioned localStorage.
// Score formula (must match internal/quiz Go):
//   correct → 100 + max(0, 50 − floor(ms/200)) + 10×(streak−1); wrong → 0.

export type QuizMode = 'flag-to-country' | 'country-to-flag' | 'flag-to-capital' | 'flag-to-region' | 'mixed';
export type QuizDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

export type FlagOption = { code: string; flagUrl: string };

export type QuizQuestion = {
  id: number;
  code: string;
  mode: QuizMode;
  flagUrl?: string;
  prompt: string;
  options: string[] | FlagOption[];
  answer: number;
};

export type QuizSet = {
  seed: string;
  mode: string;
  difficulty: string;
  count: number;
  questions: QuizQuestion[];
};

export type QuizMeta = {
  modes: { id: string; name: string; description: string }[];
  difficulties: { id: string; name: string; description: string }[];
  counts: number[];
  daily: { date: string; dailyNumber: number; seed: string; mode: string; difficulty: string; count: number };
};

export function scoreQuestion(correct: boolean, elapsedMs: number, streak: number): number {
  if (!correct) return 0;
  const ms = Math.max(0, elapsedMs);
  const bucketed = Math.floor(ms / 100) * 100; // 100ms bucketing for lossless duel packing
  const timeBonus = Math.max(0, 50 - Math.floor(bucketed / 200));
  const streakBonus = streak > 1 ? 10 * (streak - 1) : 0;
  return 100 + timeBonus + streakBonus;
}

export function isFlagOptions(o: QuizQuestion['options']): o is FlagOption[] {
  return Array.isArray(o) && o.length > 0 && typeof (o as unknown[])[0] === 'object';
}

export async function fetchQuizMeta(): Promise<QuizMeta | null> {
  try {
    const r = await fetch('/api/v1/quiz/meta');
    if (!r.ok) return null;
    return (await r.json()) as QuizMeta;
  } catch {
    return null;
  }
}

export async function fetchQuestions(params: {
  mode: string;
  difficulty: string;
  count: number;
  seed?: string;
}): Promise<QuizSet | null> {
  try {
    const sp = new URLSearchParams({
      mode: params.mode,
      difficulty: params.difficulty,
      count: String(params.count),
    });
    if (params.seed) sp.set('seed', params.seed);
    const r = await fetch(`/api/v1/quiz/questions?${sp.toString()}`);
    if (!r.ok) return null;
    return (await r.json()) as QuizSet;
  } catch {
    return null;
  }
}

export async function fetchDaily(): Promise<{
  date: string;
  dailyNumber: number;
  seed: string;
  mode: string;
  difficulty: string;
  count: number;
  quiz: QuizSet;
} | null> {
  try {
    const r = await fetch('/api/v1/quiz/daily');
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// ── versioned localStorage (corrupt → reset silently) ─────────────────

const STATS_KEY = 'flags.quiz.stats.v1';
const DAILY_KEY = 'flags.quiz.daily.v1';

export type QuizStats = {
  games: number;
  bestScore: number;
  bestStreak: number;
  totalCorrect: number;
  totalAnswered: number;
  recent: { score: number; correct: number; total: number; mode: string; date: string }[];
};

const EMPTY_STATS: QuizStats = { games: 0, bestScore: 0, bestStreak: 0, totalCorrect: 0, totalAnswered: 0, recent: [] };

export function loadStats(): QuizStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return { ...EMPTY_STATS };
    const p = JSON.parse(raw) as Partial<QuizStats>;
    return {
      games: typeof p.games === 'number' ? p.games : 0,
      bestScore: typeof p.bestScore === 'number' ? p.bestScore : 0,
      bestStreak: typeof p.bestStreak === 'number' ? p.bestStreak : 0,
      totalCorrect: typeof p.totalCorrect === 'number' ? p.totalCorrect : 0,
      totalAnswered: typeof p.totalAnswered === 'number' ? p.totalAnswered : 0,
      recent: Array.isArray(p.recent) ? p.recent.slice(0, 10) : [],
    };
  } catch {
    return { ...EMPTY_STATS };
  }
}

export function recordGame(s: { score: number; correct: number; total: number; bestStreak: number; mode: string }): QuizStats {
  const cur = loadStats();
  const next: QuizStats = {
    games: cur.games + 1,
    bestScore: Math.max(cur.bestScore, s.score),
    bestStreak: Math.max(cur.bestStreak, s.bestStreak),
    totalCorrect: cur.totalCorrect + s.correct,
    totalAnswered: cur.totalAnswered + s.total,
    recent: [{ score: s.score, correct: s.correct, total: s.total, mode: s.mode, date: new Date().toISOString() }, ...cur.recent].slice(0, 10),
  };
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
  return next;
}

export type DailyState = { lastCompletedDate: string; dailyStreak: number; history: { date: string; number: number; score: number }[] };

export function loadDaily(): DailyState {
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    if (!raw) return { lastCompletedDate: '', dailyStreak: 0, history: [] };
    const p = JSON.parse(raw) as Partial<DailyState>;
    return {
      lastCompletedDate: typeof p.lastCompletedDate === 'string' ? p.lastCompletedDate : '',
      dailyStreak: typeof p.dailyStreak === 'number' ? p.dailyStreak : 0,
      history: Array.isArray(p.history) ? p.history : [],
    };
  } catch {
    return { lastCompletedDate: '', dailyStreak: 0, history: [] };
  }
}

function yesterdayUTC(dateStr: string): string {
  const t = new Date(`${dateStr}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() - 1);
  return t.toISOString().slice(0, 10);
}

export function recordDaily(date: string, num: number, score: number): DailyState {
  const cur = loadDaily();
  const continued = cur.lastCompletedDate === yesterdayUTC(date);
  const next: DailyState = {
    lastCompletedDate: date,
    dailyStreak: cur.lastCompletedDate === date ? cur.dailyStreak : continued || cur.dailyStreak === 0 ? cur.dailyStreak + 1 : 1,
    history: [{ date, number: num, score }, ...cur.history.filter((h) => h.date !== date)].slice(0, 30),
  };
  try {
    localStorage.setItem(DAILY_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function shareText(opts: { score: number; correct: number; total: number; seed: string; mode: string; dailyNumber?: number; rows: boolean[] }): string {
  const emoji = opts.rows.map((c) => (c ? '🟩' : '🟥')).join('');
  const head = opts.dailyNumber ? `Flag Daily #${opts.dailyNumber}` : `Flag Quiz (${opts.mode})`;
  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/quiz/play?mode=${encodeURIComponent(opts.mode)}&seed=${encodeURIComponent(opts.seed)}`;
  return `${head}: ${opts.correct}/${opts.total} — ${opts.score} pts\n${emoji}\n${url}`;
}
