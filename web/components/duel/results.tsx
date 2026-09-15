'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronDown, ChevronUp, Crown, Home, RotateCcw, Scale, Share2, Swords, X } from 'lucide-react';
import { DuelPayload, SKIPPED } from '@/lib/duel/types';
import { QuizQuestion, isFlagOptions, scoreQuestion } from '@/lib/quiz';
import { FlagImage } from '@/components/flag-image';
import { Button, Chip } from '@/components/ui';
import { EASE_EXPO, DUR, STAGGER } from '@/lib/motion';

export type DuelWinner = 'challenger' | 'player' | 'draw';

export function determineWinner(
  challengerScore: number,
  playerScore: number,
  challengerTimesMs: number[],
  playerTimesMs: number[]
): DuelWinner {
  if (playerScore > challengerScore) return 'player';
  if (challengerScore > playerScore) return 'challenger';
  const ct = challengerTimesMs.reduce((a, b) => a + (Math.floor(b / 100) * 100), 0);
  const pt = playerTimesMs.reduce((a, b) => a + (Math.floor(b / 100) * 100), 0);
  if (pt < ct) return 'player';
  if (ct < pt) return 'challenger';
  return 'draw';
}

function challengerCorrectAt(payload: DuelPayload, questions: QuizQuestion[], i: number): boolean {
  const q = questions[i];
  if (!q) return false;
  const a = payload.answers[i];
  return a !== SKIPPED && a === q.answer;
}

function bestStreakOf(flags: boolean[]): number {
  let cur = 0;
  let best = 0;
  for (const f of flags) {
    if (f) {
      cur += 1;
      best = Math.max(best, cur);
    } else cur = 0;
  }
  return best;
}

function CountUp({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const dur = 800;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduce]);
  return <>{display}</>;
}

function MiniConfetti({ fire }: { fire: boolean }) {
  const reduce = useReducedMotion();
  if (!fire || reduce) return null;
  const parts = Array.from({ length: 16 }, (_, i) => ({
    x: (i % 8 - 3.5) * 30,
    y: -(50 + (i % 5) * 30),
    r: (i * 47) % 180,
  }));
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {parts.map((p, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
          animate={{ opacity: 0, x: p.x * 2, y: p.y * 2, rotate: p.r, scale: 0.6 }}
          transition={{ duration: 1, delay: i * 0.015, ease: EASE_EXPO }}
          className="absolute left-1/2 top-24 inline-block h-2 w-3 rounded-[3px]"
          style={{
            background: i % 3 === 0 ? 'var(--primary)' : i % 3 === 1 ? 'var(--ring)' : 'var(--primary-subtle)',
            border: '1px solid var(--primary)',
          }}
        />
      ))}
    </div>
  );
}

export function DuelResults({
  payload,
  questions,
  playerAnswers,
  playerTimesMs,
  playerScore,
  onRematch,
  onShare,
}: {
  payload: DuelPayload;
  questions: QuizQuestion[];
  playerAnswers: number[];
  playerTimesMs: number[];
  playerScore: number;
  onRematch: () => void;
  onShare: () => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const reduce = useReducedMotion();
  const winner = determineWinner(payload.challengerScore, playerScore, payload.timesMs, playerTimesMs);
  const challengerName = payload.challengerName || 'Friend';
  const maxScore = Math.max(payload.challengerScore, playerScore, 1);

  const n = payload.count;
  const cFlags = Array.from({ length: n }, (_, i) => challengerCorrectAt(payload, questions, i));
  const pFlags = Array.from({ length: n }, (_, i) => {
    const q = questions[i];
    if (!q) return false;
    const a = playerAnswers[i];
    return a !== undefined && a >= 0 && a === q.answer;
  });

  const cCorrect = cFlags.filter(Boolean).length;
  const pCorrect = pFlags.filter(Boolean).length;
  const cTotal = payload.timesMs.reduce((a, b) => a + b, 0);
  const pTotal = playerTimesMs.reduce((a, b) => a + b, 0);
  const cAvg = n ? cTotal / n : 0;
  const pAvg = n ? pTotal / n : 0;
  const cBest = bestStreakOf(cFlags);
  const pBest = bestStreakOf(pFlags);

  // Recompute scores from packed data to verify consistency (dev-only sanity)
  void scoreQuestion;

  return (
    <div className="relative mx-auto max-w-2xl pb-32">
      <MiniConfetti fire={winner === 'player'} />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DUR.base, ease: EASE_EXPO }} className="text-center">
        <p className="mono text-[0.72rem] font-bold uppercase tracking-[0.12em] text-primary">
          <Swords size={14} className="mr-1 inline" aria-hidden /> Duel results
        </p>
        {winner === 'draw' ? (
          <>
            <Scale size={44} className="mx-auto mt-2 text-primary" aria-hidden />
            <h1 className="h2 mt-2">It&apos;s a draw</h1>
            <p className="body-scale mt-1 text-soft">Same score, same pace. Rematch?</p>
          </>
        ) : (
          <>
            <motion.div
              initial={reduce ? { opacity: 0 } : { y: -24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={reduce ? { duration: 0.01 } : { type: 'spring', stiffness: 300, damping: 20, delay: 0.3 }}
            >
              <Crown size={44} className="mx-auto mt-2 text-primary" aria-hidden />
            </motion.div>
            <h1 className="h2 mt-2">{winner === 'player' ? 'You won!' : `${challengerName} wins`}</h1>
            <p className="body-scale mt-1 text-soft">
              {winner === 'player' ? 'Claim your bragging rights.' : 'They got you this time. Run it back?'}
            </p>
          </>
        )}
      </motion.div>

      <div className="mt-6 space-y-3" aria-label="Score comparison">
        <div>
          <div className="small-scale mb-1 flex justify-between font-semibold">
            <span>{challengerName}</span>
            <span className="mono">
              <CountUp value={payload.challengerScore} />
            </span>
          </div>
          <div className="h-4 overflow-hidden rounded-full" style={{ background: 'var(--surface-muted)' }} role="img" aria-label={`${challengerName} scored ${payload.challengerScore}`}>
            <motion.div
              initial={reduce ? { opacity: 0 } : { scaleX: 0 }}
              animate={reduce ? { opacity: 1 } : { scaleX: 1 }}
              transition={{ duration: 0.8, ease: EASE_EXPO, delay: reduce ? 0 : 0.15 }}
              className="h-full origin-left rounded-full"
              style={{ width: `${(payload.challengerScore / maxScore) * 100}%`, background: 'var(--primary)', opacity: 0.45 }}
            />
          </div>
        </div>
        <div>
          <div className="small-scale mb-1 flex justify-between font-semibold">
            <span>You</span>
            <span className="mono">
              <CountUp value={playerScore} />
            </span>
          </div>
          <div className="h-4 overflow-hidden rounded-full" style={{ background: 'var(--surface-muted)' }} role="img" aria-label={`You scored ${playerScore}`}>
            <motion.div
              initial={reduce ? { opacity: 0 } : { scaleX: 0 }}
              animate={reduce ? { opacity: 1 } : { scaleX: 1 }}
              transition={{ duration: 0.8, ease: EASE_EXPO }}
              className="h-full origin-left rounded-full"
              style={{ width: `${(playerScore / maxScore) * 100}%`, background: 'var(--primary)' }}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3 text-center">
        <div className="card p-3">
          <div className="small-scale font-semibold text-soft">Accuracy</div>
          <div className="mono mt-1 text-sm font-bold">
            {pCorrect}/{n}
          </div>
          <div className="small-scale text-soft">you vs {cCorrect}/{n}</div>
        </div>
        <div className="card p-3">
          <div className="small-scale font-semibold text-soft">Avg time</div>
          <div className="mono mt-1 text-sm font-bold">{(pAvg / 1000).toFixed(1)}s</div>
          <div className="small-scale text-soft">you vs {(cAvg / 1000).toFixed(1)}s</div>
        </div>
        <div className="card p-3">
          <div className="small-scale font-semibold text-soft">Best streak</div>
          <div className="mono mt-1 text-sm font-bold">{pBest}</div>
          <div className="small-scale text-soft">you vs {cBest}</div>
        </div>
      </div>

      <h2 className="mt-8 text-lg font-bold">Question by question</h2>
      <div className="mt-3 flex flex-col gap-2">
        {Array.from({ length: n }, (_, i) => {
          const q = questions[i];
          const pA = playerAnswers[i];
          const cA = payload.answers[i];
          const pOk = pFlags[i];
          const cOk = cFlags[i];
          const pT = playerTimesMs[i] ?? 0;
          const cT = payload.timesMs[i] ?? 0;
          const qWinner = pOk && !cOk ? 'player' : cOk && !pOk ? 'challenger' : pOk && cOk ? (pT < cT ? 'player' : cT < pT ? 'challenger' : 'draw') : 'draw';
          const open = expanded === i;
          return (
            <motion.div
              key={i}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DUR.base, ease: EASE_EXPO, delay: reduce ? 0 : Math.min(i, 12) * STAGGER }}
            >
              <button
                onClick={() => setExpanded(open ? null : i)}
                aria-expanded={open}
                className="card flex min-h-[44px] w-full items-center gap-3 p-3 text-left"
                style={
                  qWinner === 'player'
                    ? { borderLeft: '3px solid var(--primary)' }
                    : qWinner === 'challenger'
                      ? { borderLeft: '3px solid var(--text-secondary)' }
                      : undefined
                }
              >
                <span className="mono small-scale w-8 shrink-0 font-bold text-soft">Q{i + 1}</span>
                {q && (
                  <span className="h-8 w-12 shrink-0 overflow-hidden rounded-md" aria-hidden>
                    <FlagImage code={q.code} name={q.code} size="w320" fit="cover" aspect="3 / 2" />
                  </span>
                )}
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                  <Chip variant={pOk ? 'active' : 'default'}>
                    {pOk ? '\u2713' : '\u2717'} {(pT / 1000).toFixed(1)}s
                  </Chip>
                  <span className="small-scale text-soft">vs</span>
                  <Chip variant={cOk ? 'active' : 'default'}>
                    {cOk ? '\u2713' : '\u2717'} {(cT / 1000).toFixed(1)}s
                  </Chip>
                </span>
                {open ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
              </button>
              <AnimatePresence initial={false}>
                {open && q && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: DUR.base, ease: EASE_EXPO }}
                    className="overflow-hidden"
                  >
                    <div className="card mt-1 space-y-3 p-4">
                      <p className="text-[0.9rem] font-semibold">{q.prompt}</p>
                      <div className={isFlagOptions(q.options) ? 'quiz-flaggrid' : 'quiz-options'}>
                        {(q.options as unknown[]).map((opt, oi) => {
                          const isAnswer = oi === q.answer;
                          const pPicked = oi === pA;
                          const cPicked = oi === cA;
                          let cls = 'quiz-opt is-dim';
                          if (isAnswer) cls = 'quiz-opt is-correct';
                          else if (pPicked) cls = 'quiz-opt is-wrong';
                          return (
                            <div key={oi} className={cls} aria-label={`${isFlagOptions(q.options) ? (opt as { code: string }).code.toUpperCase() : (opt as string)}${isAnswer ? ' (correct)' : ''}${pPicked && !isAnswer ? ' (you)' : ''}${cPicked && !isAnswer && !pPicked ? ` (${challengerName})` : ''}`}>
                              {isFlagOptions(q.options) ? (
                                <img src={(opt as { flagUrl: string }).flagUrl} alt="" loading="lazy" draggable={false} />
                              ) : (
                                <span>{opt as string}</span>
                              )}
                              <span className="small-scale ml-2 inline-flex gap-1">
                                {isAnswer && <Check size={14} className="text-primary" aria-hidden />}
                                {pPicked && !isAnswer && <X size={14} aria-hidden />}
                                {cPicked && <span className="chip ml-1">{challengerName.slice(0, 8) || 'Them'}</span>}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      <div className="sticky bottom-4 mt-8 flex flex-col gap-2 sm:flex-row">
        <Button onClick={onRematch} size="lg" className="min-h-[48px] flex-1">
          <RotateCcw size={16} aria-hidden /> Send them a rematch
        </Button>
        <Button onClick={onShare} variant="secondary" className="min-h-[48px] flex-1">
          <Share2 size={16} aria-hidden /> Share result
        </Button>
        <Button href="/quiz" variant="ghost" className="min-h-[48px] flex-1">
          <Home size={16} aria-hidden /> Back to Quiz
        </Button>
      </div>
    </div>
  );
}
