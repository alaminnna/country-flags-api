'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { CalendarDays, Flame, Play, Swords, Trophy } from 'lucide-react';
import { EASE_EXPO, STAGGER } from '../../lib/motion';
import { fetchDaily, fetchQuizMeta, loadDaily, loadStats, type QuizMeta } from '../../lib/quiz';
import { countdownToNextDailyUTC, levelForXP } from '../../lib/quiz-cosmetics';
import { SegmentedControl } from '../../components/ui';
import { Stat } from '../../components/stat';
import { ModeGlyph } from '../../components/quiz/mode-identity';
import { DifficultyMeter } from '../../components/quiz/quiz-chrome';
import { LevelRing, XpBar } from '../../components/quiz/player-profile';
import { useNowTick } from '../../components/quiz/quiz-chrome';
import '../../components/quiz/quiz-game.css';

const DIFFS = ['easy', 'medium', 'hard', 'expert'];
const COUNTS = [5, 10, 15, 20];

function ScoreRing({ pct, size = 96 }: { pct: number; size?: number }) {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${Math.round(pct)} percent`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={8} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.min(1, Math.max(0, pct / 100)))}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 800ms cubic-bezier(0.16,1,0.3,1)' }}
      />
    </svg>
  );
}

function last14DaysUTC(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export default function QuizHub() {
  const [meta, setMeta] = useState<QuizMeta | null>(null);
  const [dailyQuiz, setDailyQuiz] = useState<{ date: string; dailyNumber: number; mode: string; difficulty: string; count: number; seed: string } | null>(null);
  const [stats, setStats] = useState({ games: 0, bestScore: 0, bestStreak: 0, totalCorrect: 0, totalAnswered: 0, recent: [] as { score: number; correct: number; total: number; mode: string; date: string }[] });
  const [dailyState, setDailyState] = useState({ lastCompletedDate: '', dailyStreak: 0, history: [] as { date: string; number: number; score: number }[] });
  const [diff, setDiff] = useState('medium');
  const [count, setCount] = useState(10);
  const [showScoring, setShowScoring] = useState(false);
  const reduce = useReducedMotion();
  const now = useNowTick(true, 1000);
  const cd = countdownToNextDailyUTC(now);

  useEffect(() => {
    fetchQuizMeta().then((m) => {
      if (m) setMeta(m);
    });
    fetchDaily().then((d) => {
      if (d) setDailyQuiz({ date: d.date, dailyNumber: d.dailyNumber, mode: d.mode, difficulty: d.difficulty, count: d.count, seed: d.seed });
    });
    setStats(loadStats());
    const dl = loadDaily();
    setDailyState({ lastCompletedDate: dl.lastCompletedDate, dailyStreak: dl.dailyStreak, history: dl.history });
  }, []);

  const dailyDone = dailyQuiz ? dailyState.lastCompletedDate === dailyQuiz.date : false;
  const dailyScore = (() => {
    try {
      return dailyState.history.find((h) => h.date === dailyQuiz?.date)?.score ?? 0;
    } catch {
      return 0;
    }
  })();

  const days = useMemo(() => last14DaysUTC(), []);
  const doneSet = useMemo(() => new Set(dailyState.history.map((h) => h.date)), [dailyState.history]);
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const modes = meta?.modes ?? [
    { id: 'flag-to-country', name: 'Flag → Country', description: 'See a flag, pick the country name.' },
    { id: 'country-to-flag', name: 'Country → Flag', description: 'See a country name, pick its flag.' },
    { id: 'flag-to-capital', name: 'Flag → Capital', description: 'See a flag, pick the capital city.' },
    { id: 'flag-to-region', name: 'Flag → Region', description: 'See a flag, pick the continent.' },
    { id: 'mixed', name: 'Mixed', description: 'A shuffled mix of all four modes.' },
  ];

  const bestByMode = useMemo(() => {
    const m = new Map<string, { best: number; plays: number }>();
    for (const r of stats.recent) {
      const cur = m.get(r.mode) ?? { best: 0, plays: 0 };
      cur.best = Math.max(cur.best, r.score);
      cur.plays += 1;
      m.set(r.mode, cur);
    }
    return m;
  }, [stats.recent]);

  const xp = stats.totalCorrect;
  const lv = levelForXP(xp);
  void lv;

  return (
    <div className="page-shell q-page pt-8 lg:pt-12">
      <div className="max-w-prose">
        <p className="mono mb-2 text-[0.72rem] font-bold uppercase tracking-[0.12em] text-primary">Play</p>
        <h1 className="h2">Flag Quiz</h1>
        <p className="body-scale mt-3 text-soft">Seeded, stateless, shareable. Same seed → same quiz, everywhere. No account, streaks live in your browser.</p>
      </div>

      {/* DAILY HERO — wide card, the ONE earned glow */}
      <motion.section
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE_EXPO }}
        className="q-dailyhero mt-6"
        aria-label="Daily challenge"
      >
        <div className="q-dailygrid">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip chip-iso">
                <CalendarDays size={13} aria-hidden /> {dailyQuiz ? `Daily #${dailyQuiz.dailyNumber}` : 'Daily'}
              </span>
              {dailyQuiz && <span className="chip mono">{dailyQuiz.date}</span>}
              {dailyQuiz && (
                <span className="chip chip-active">
                  <ModeGlyph mode={dailyQuiz.mode} size={13} /> {dailyQuiz.mode}
                </span>
              )}
              {dailyQuiz && (
                <span className="chip">
                  <DifficultyMeter difficulty={dailyQuiz.difficulty} size={12} /> {dailyQuiz.difficulty}
                </span>
              )}
              {dailyState.dailyStreak > 0 && (
                <span className="chip" aria-label={`${dailyState.dailyStreak} day streak`}>
                  <Flame size={13} aria-hidden /> {dailyState.dailyStreak}
                </span>
              )}
            </div>
            <h2 className="h3 mt-3">Today&apos;s challenge — {dailyQuiz ? `${dailyQuiz.count} questions` : '10 questions'}</h2>
            <p className="body-scale mt-1 text-soft">Everyone on Earth gets the same quiz today.</p>
            <p className="q-clock mt-2 text-[0.85rem] text-soft" aria-live="off">
              Next daily in <span aria-label={`Next daily in ${cd.label}`}>{cd.label}</span> UTC
            </p>
            <div className="q-dots" role="img" aria-label="Last 14 days of daily completions">
              {days.map((d) => (
                <span
                  key={d}
                  className={`q-dot ${doneSet.has(d) ? 'is-done' : ''} ${d === todayStr ? 'is-today' : ''}`}
                  title={d}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-start lg:justify-end">
            {dailyDone ? (
              <div className="flex items-center gap-4">
                <ScoreRing pct={Math.min(100, (dailyScore / Math.max(1, (dailyQuiz?.count ?? 10) * 150)) * 100)} />
                <div>
                  <p className="mono text-[1.1rem] font-extrabold">{dailyScore} pts</p>
                  <p className="small-scale text-soft">Done — back in {cd.label}</p>
                </div>
              </div>
            ) : (
              dailyQuiz && (
                <Link
                  href={`/quiz/play?mode=${dailyQuiz.mode}&difficulty=${dailyQuiz.difficulty}&count=${dailyQuiz.count}&seed=${dailyQuiz.seed}&daily=1`}
                  className="btn btn-primary btn-lg"
                  aria-label={`Play daily number ${dailyQuiz.dailyNumber}`}
                >
                  <Play size={18} aria-hidden /> Play daily
                </Link>
              )
            )}
          </div>
        </div>
      </motion.section>

      {/* difficulty / count selectors */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <SegmentedControl ariaLabel="Default difficulty" value={diff} onChange={setDiff} options={DIFFS.map((d) => ({ value: d, label: d[0].toUpperCase() + d.slice(1) }))} />
        <SegmentedControl ariaLabel="Question count" value={String(count)} onChange={(v) => setCount(parseInt(v, 10) || 10)} options={COUNTS.map((c) => ({ value: String(c), label: String(c) }))} />
      </div>

      {/* tiles + player band asymmetric split */}
      <div className="q-hubsplit mt-4">
        <div className="q-tiles">
          {modes.map((m, i) => {
            const bm = bestByMode.get(m.id);
            const featured = m.id === 'mixed';
            return (
              <motion.article
                key={m.id}
                className={`q-tilecard ${featured ? 'is-featured' : ''}`}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.4, delay: Math.min(i, 5) * STAGGER, ease: EASE_EXPO }}
                aria-label={`${m.name} game tile`}
              >
                {featured && (
                  <span className="q-featurebg" aria-hidden>
                    <span style={{ display: 'inline-flex', gap: 6 }}>
                      <ModeGlyph mode="flag-to-country" size={44} />
                      <ModeGlyph mode="country-to-flag" size={44} />
                      <ModeGlyph mode="flag-to-capital" size={44} />
                      <ModeGlyph mode="flag-to-region" size={44} />
                    </span>
                  </span>
                )}
                <span className="q-identity" aria-hidden>
                  <ModeGlyph mode={m.id} size={26} />
                </span>
                <h3 className="mt-2 text-[1.02rem] font-bold tracking-tight">{m.name}</h3>
                <p className="body-scale mt-1 text-soft">{m.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <DifficultyMeter difficulty={diff} size={13} />
                  <span className="chip mono">{count}Q</span>
                  {bm ? (
                    <span className="small-scale mono text-soft">
                      best {bm.best.toLocaleString('en-US')} · {bm.plays}×
                    </span>
                  ) : (
                    <span className="small-scale text-soft">unplayed</span>
                  )}
                </div>
                <Link
                  href={`/quiz/play?mode=${m.id}&difficulty=${diff}&count=${count}`}
                  className="btn btn-secondary btn-sm q-cta mt-4"
                  aria-label={`Play ${m.name}, ${diff}, ${count} questions`}
                >
                  <Play size={14} aria-hidden /> Play
                </Link>
              </motion.article>
            );
          })}
          {/* DUEL card */}
          <motion.article
            className="q-tilecard"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.4, ease: EASE_EXPO }}
            aria-label="Challenge a friend"
          >
            <span className="q-identity" aria-hidden>
              <Swords size={24} />
            </span>
            <h3 className="mt-2 text-[1.02rem] font-bold tracking-tight">Challenge a friend</h3>
            <p className="body-scale mt-1 text-soft">Share any quiz link — the seed replays the identical quiz on their device. Highest score wins.</p>
            {stats.recent.length > 0 && (
              <p className="small-scale mono mt-2 text-soft">
                recent: {stats.recent.slice(0, 2).map((r) => `${r.mode} ${r.score}`).join(' · ')}
              </p>
            )}
            <Link href="/quiz/duel" className="btn btn-ghost btn-sm q-cta mt-4" aria-label="Open duel matchup poster">
              <Swords size={14} aria-hidden /> Duel poster
            </Link>
          </motion.article>
        </div>

        {/* PLAYER BAND — sticky 1/3 col, compact strip on mobile */}
        <aside className="q-profilecol" aria-label="Your player profile">
          <div className="q-band">
            <div className="flex items-center gap-3">
              <LevelRing xp={xp} />
              <div className="min-w-0 flex-1">
                <p className="font-bold">Your progress</p>
                <XpBar xp={xp} />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <Stat value={stats.games} label="Games" />
              <Stat value={stats.bestScore} label="Best score" />
              <Stat value={stats.bestStreak} label="Best streak" />
              <Stat value={dailyState.dailyStreak} label="Daily streak" />
            </div>
          </div>
          <div className="q-band">
            <button
              className="flex w-full items-center justify-between text-left"
              onClick={() => setShowScoring((s) => !s)}
              aria-expanded={showScoring}
              style={{ minHeight: 44 }}
            >
              <span className="font-bold">How scoring works</span>
              <span className="text-soft">{showScoring ? '−' : '+'}</span>
            </button>
            {showScoring && (
              <div className="body-scale mt-3 space-y-2 text-soft">
                <p>
                  Correct = <code className="mono">100 + timeBonus + streakBonus</code>
                </p>
                <p>
                  <code className="mono">timeBonus = max(0, 50 − floor(ms/200))</code> — instant earns +50, after 10s +0.
                </p>
                <p>
                  <code className="mono">streakBonus = 10 × (streak−1)</code> — third in a row earns +20.
                </p>
                <p>Wrong or timeout (15s) = 0 and resets the streak. Server grades identically.</p>
              </div>
            )}
          </div>
          <div className="q-band flex items-center gap-3">
            <Trophy size={18} aria-hidden className="text-primary" />
            <p className="small-scale text-soft">
              {stats.games === 0
                ? 'Play your first game to earn XP and a level ring.'
                : `${stats.totalCorrect.toLocaleString('en-US')} correct answers lifetime.`}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
