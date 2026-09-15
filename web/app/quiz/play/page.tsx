'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Check, Flame, Home, RotateCcw, Share2, Swords, Volume2, VolumeX, X } from 'lucide-react';
import { DUR, EASE_EXPO } from '../../../lib/motion';
import {
  fetchQuestions,
  isFlagOptions,
  loadStats,
  recordDaily,
  recordGame,
  scoreQuestion,
  shareText,
  type FlagOption,
  type QuizSet,
} from '../../../lib/quiz';
import { countdownToNextDailyUTC, levelForXP, rankForAccuracy } from '../../../lib/quiz-cosmetics';
import { loadSoundPref, saveSoundPref, sfxCorrect, sfxTick, sfxWrong } from '../../../lib/quiz-sound';
import { FlagImage } from '../../../components/flag-image';
import { ModeGlyph } from '../../../components/quiz/mode-identity';
import {
  DifficultyMeter,
  ProgressPills,
  ScoreChip,
  SparkBurst,
  StreakFlame,
  TimerArc,
  useNowTick,
} from '../../../components/quiz/quiz-chrome';
import { FlagStage } from '../../../components/quiz/flag-stage';
import { AccuracyRing, RankStamp } from '../../../components/quiz/rank-stamp';
import { LevelRing } from '../../../components/quiz/player-profile';
import { useCopy } from '../../../lib/hooks';
import { useToast } from '../../../components/toast';
import { decodeDuel } from '../../../lib/duel/codec';
import { recordCompletedDuel } from '../../../lib/duel/storage';
import { SKIPPED, type DuelPayload } from '../../../lib/duel/types';
import { DuelScoreChip, GhostMarker, GhostResultChip, getChallengerRunningScore } from '../../../components/duel/ghost-hud';
import { DuelResults } from '../../../components/duel/results';
import { DuelCreateSheet } from '../../../components/duel/create-sheet';
import '../../../components/quiz/quiz-game.css';

const PER_QUESTION_MS = 15000;

type Phase = 'loading' | 'playing' | 'reveal' | 'curtain' | 'done';
type AnswerRow = { chosen: number; ms: number; correct: boolean; points: number };

function useCountdown(active: boolean, startedAt: number, duration: number) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = () => {
      force((n) => n + 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, startedAt]);
  const elapsed = Date.now() - startedAt;
  return Math.max(0, Math.min(1, elapsed / duration));
}

function Confetti({ fire }: { fire: boolean }) {
  const reduce = useReducedMotion();
  const parts = useMemo(() => Array.from({ length: 24 }).map((_, i) => ({ x: (i % 8 - 3.5) * 34, y: -(60 + (i % 5) * 36), r: (i * 47) % 180 })), []);
  if (!fire || reduce) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {parts.map((p, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
          animate={{ opacity: 0, x: p.x * 2.2, y: p.y * 2.4, rotate: p.r, scale: 0.6 }}
          transition={{ duration: 1.1, delay: i * 0.015, ease: EASE_EXPO }}
          className="absolute left-1/2 top-1/3 inline-block h-2 w-3 rounded-[3px]"
          style={{ background: i % 3 === 0 ? 'var(--primary)' : i % 3 === 1 ? 'var(--ring)' : 'var(--primary-subtle)', border: '1px solid var(--primary)' }}
        />
      ))}
    </div>
  );
}

function useCountUp(target: number, ms = 1200): number {
  const reduce = useReducedMotion();
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (reduce) {
      setVal(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(2, -10 * p); // expo-out
      setVal(Math.round(target * (p === 1 ? 1 : e)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, reduce]);
  return val;
}

function vibrate(pattern: number | number[]) {
  try {
    (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }).vibrate?.(pattern);
  } catch {
    /* progressive enhancement */
  }
}

function PlayInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const reduce = useReducedMotion();
  const { push } = useToast();
  const { copy } = useCopy();

  const mode = sp.get('mode') || 'mixed';
  const difficulty = sp.get('difficulty') || 'medium';
  const count = parseInt(sp.get('count') || '10', 10) || 10;
  const seedParam = sp.get('seed') || '';
  const isDaily = sp.get('daily') === '1';
  // seed-link duel params (plain, human-readable — no new codec/storage)
  const duelName = sp.get('duelName') || '';
  const duelScore = sp.get('duelScore') ? parseInt(sp.get('duelScore') as string, 10) || 0 : 0;
  const isDuel = duelName !== '' || duelScore > 0;
  // packed binary duel: ?d= payload carries answers+times for ghost + head-to-head
  const duelParam = sp.get('d') || '';
  const [packed, setPacked] = useState<DuelPayload | null | undefined>(duelParam ? undefined : null);
  const [showRematchSheet, setShowRematchSheet] = useState(false);
  useEffect(() => {
    if (!duelParam) {
      setPacked(null);
      return;
    }
    try {
      setPacked(decodeDuel(duelParam));
    } catch {
      setPacked(null);
    }
  }, [duelParam]);

  const [quiz, setQuiz] = useState<QuizSet | null>(null);
  const [failed, setFailed] = useState(false);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('loading');
  const [chosen, setChosen] = useState<number | null>(null);
  const [rows, setRows] = useState<AnswerRow[]>([]);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [score, setScore] = useState(0);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [floatPts, setFloatPts] = useState<number | null>(null);
  const [floatKey, setFloatKey] = useState(0);
  const [burstKey, setBurstKey] = useState(0);
  const [milestone, setMilestone] = useState(false);
  const [tilt, setTilt] = useState(false);
  const [isPB, setIsPB] = useState(false);
  const [prevBest, setPrevBest] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickedRef = useRef<number>(0);

  useEffect(() => {
    if (phase === 'playing') {
      document.body.dataset.footerHidden = 'true';
    } else {
      delete document.body.dataset.footerHidden;
    }
    return () => { delete document.body.dataset.footerHidden; };
  }, [phase]);

  useEffect(() => {
    setSoundOn(loadSoundPref());
    try {
      setPrevBest(loadStats().bestScore);
    } catch {
      /* ignore */
    }
  }, []);

  // packed duels override fetch params to guarantee the identical quiz
  const effMode = packed ? packed.mode : mode;
  const effDifficulty = packed ? packed.difficulty : difficulty;
  const effCount = packed ? packed.count : count;
  const effSeed = packed ? packed.seed.toString() : seedParam || undefined;

  useEffect(() => {
    if (duelParam && packed === undefined) return; // still decoding ?d=
    setPhase('loading');
    fetchQuestions({ mode: effMode, difficulty: effDifficulty, count: effCount, seed: effSeed }).then((q) => {
      if (!q || q.questions.length === 0) {
        setFailed(true);
        setPhase('loading');
        return;
      }
      setQuiz(q);
      setIdx(0);
      setRows([]);
      setScore(0);
      setStreak(0);
      setBest(0);
      setChosen(null);
      setPhase('playing');
      setStartedAt(Date.now());
      tickedRef.current = 0;
      // refresh URL with the canonical seed so refresh/share replays identically
      const url = `/quiz/play?mode=${encodeURIComponent(q.mode)}&difficulty=${encodeURIComponent(q.difficulty)}&count=${q.count}&seed=${encodeURIComponent(q.seed)}${isDaily ? '&daily=1' : ''}${isDuel ? `&duelName=${encodeURIComponent(duelName)}&duelScore=${duelScore}` : ''}${duelParam ? `&d=${encodeURIComponent(duelParam)}` : ''}`;
      window.history.replaceState(null, '', url);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effMode, effDifficulty, effCount, effSeed, duelParam]);

  const q = quiz?.questions[idx] ?? null;
  const progress = useCountdown(phase === 'playing', startedAt, PER_QUESTION_MS);

  const advance = useCallback(() => {
    if (!quiz) return;
    if (idx + 1 >= quiz.questions.length) {
      // LAST QUESTION → RESULTS curtain: HUD fades, stage scales 1.04 then crossfades 400ms
      setPhase('curtain');
      window.setTimeout(() => setPhase('done'), reduce ? 60 : 420);
    } else {
      setIdx((i) => i + 1);
      setChosen(null);
      setFloatPts(null);
      setMilestone(false);
      setTilt(false);
      setPhase('playing');
      setStartedAt(Date.now());
      tickedRef.current = 0;
    }
  }, [idx, quiz, reduce]);

  const answer = useCallback(
    (pick: number) => {
      if (phase !== 'playing' || !q) return;
      const ms = Date.now() - startedAt;
      const correct = pick === q.answer;
      const timedOut = pick === -1;
      const ns = correct ? streak + 1 : 0;
      const pts = scoreQuestion(correct, ms, ns);
      setChosen(pick);
      setStreak(ns);
      setBest((b) => Math.max(b, ns));
      setScore((s) => s + pts);
      setRows((r) => [...r, { chosen: pick, ms, correct, points: pts }]);
      setFloatPts(pts);
      setFloatKey((k) => k + 1);
      setPhase('reveal');
      if (timerRef.current) clearTimeout(timerRef.current);
      // exact holds: correct 650ms / wrong 1100ms / timeout 900ms
      const hold = timedOut ? 900 : correct ? 650 : 1100;
      if (!timedOut) {
        if (correct) {
          vibrate(15);
          sfxCorrect(soundOn);
        } else {
          vibrate(30);
          sfxWrong(soundOn);
          setTilt(true);
          window.setTimeout(() => setTilt(false), 380);
        }
      }
      // streak milestones at 3/5/8
      if (correct && (ns === 3 || ns === 5 || ns === 8)) {
        setBurstKey((k) => k + 1);
        setMilestone(true);
        window.setTimeout(() => setMilestone(false), 550);
        window.setTimeout(() => setBurstKey(0), 600);
      }
      timerRef.current = setTimeout(advance, hold);
    },
    [phase, q, startedAt, streak, advance, soundOn],
  );

  // timeout
  useEffect(() => {
    if (phase !== 'playing') return;
    const t = setTimeout(() => answer(-1), PER_QUESTION_MS);
    return () => clearTimeout(t);
  }, [phase, startedAt, answer]);

  // final-3s tick (sound only, never delays interaction)
  useEffect(() => {
    if (phase !== 'playing' || !soundOn) return;
    const remain = PER_QUESTION_MS - (Date.now() - startedAt);
    if (remain <= 3200 && remain > 0 && tickedRef.current < 3) {
      tickedRef.current += 1;
      sfxTick(true);
    }
  }, [phase, progress, startedAt, soundOn]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  // keyboard: 1-4 / A-D select, Enter advances
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === 'playing' && q) {
        const n = q.options.length;
        const k = e.key.toLowerCase();
        const num = parseInt(k, 10);
        if (num >= 1 && num <= n) answer(num - 1);
        else {
          const li = 'abcdef'.indexOf(k);
          if (li >= 0 && li < n) answer(li);
        }
      } else if (phase === 'reveal' && e.key === 'Enter') {
        if (timerRef.current) clearTimeout(timerRef.current);
        advance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, q, answer, advance]);

  const total = quiz?.questions.length ?? 0;
  const correctCount = rows.filter((r) => r.correct).length;
  const accuracy = total ? (correctCount / Math.max(1, rows.length)) * 100 : 0;
  const avgMs = rows.length ? Math.round(rows.reduce((a, r) => a + r.ms, 0) / rows.length) : 0;

  // persist packed duel result for revisit (?d= checksum → full result)
  useEffect(() => {
    if (phase !== 'done' || !quiz || !packed) return;
    try {
      const pAnswers = rows.map((r) => (r.chosen < 0 ? SKIPPED : r.chosen));
      const pTimes = rows.map((r) => Math.floor(r.ms / 100) * 100);
      let winner: 'challenger' | 'player' | 'draw' = 'draw';
      if (score > packed.challengerScore) winner = 'player';
      else if (packed.challengerScore > score) winner = 'challenger';
      else {
        const ct = packed.timesMs.reduce((a, b) => a + b, 0);
        const pt = pTimes.reduce((a, b) => a + b, 0);
        winner = pt < ct ? 'player' : ct < pt ? 'challenger' : 'draw';
      }
      recordCompletedDuel({
        checksum: packed.checksum,
        payload: packed,
        playerScore: score,
        playerAnswers: pAnswers,
        playerTimesMs: pTimes,
        winner,
        completedAt: Date.now(),
      });
    } catch {
      /* never block UI on storage errors */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // persist on done (logic untouched)
  useEffect(() => {
    if (phase !== 'done' || !quiz) return;
    const prev = (() => {
      try {
        return loadStats().bestScore;
      } catch {
        return 0;
      }
    })();
    setPrevBest(prev);
    const next = recordGame({ score, correct: correctCount, total, bestStreak: best, mode: quiz.mode });
    setIsPB(score > prev && score > 0 && next.bestScore === score);
    if (isDaily) {
      const today = new Date().toISOString().slice(0, 10);
      fetch('/api/v1/quiz/daily')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.date) recordDaily(d.date, d.dailyNumber, score);
          else recordDaily(today, 0, score);
        })
        .catch(() => recordDaily(today, 0, score));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const share = async (dailyNumber?: number) => {
    if (!quiz) return;
    const text = shareText({
      score,
      correct: correctCount,
      total,
      seed: quiz.seed,
      mode: quiz.mode,
      ...(dailyNumber ? { dailyNumber } : {}),
      rows: rows.map((r) => r.correct),
    });
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Flag Quiz', text });
        return;
      }
    } catch {
      /* dismissed */
    }
    const ok = await copy(text);
    push(ok ? 'Result copied — send it to a friend' : 'Copy failed');
  };

  if (failed) {
    return (
      <div className="page-shell pt-10">
        <div className="error-state" role="alert">
          <p className="font-bold">Couldn&apos;t load the quiz.</p>
          <p className="small-scale">The API didn&apos;t respond. Check the backend, then retry.</p>
          <button className="btn btn-secondary btn-sm" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!quiz || phase === 'loading') {
    return (
      <div className="page-shell pt-10">
        <div className="mx-auto max-w-2xl">
          <div className="skeleton" style={{ minHeight: 320 }} />
        </div>
      </div>
    );
  }

  // ── PACKED DUEL RESULTS — head-to-head instead of solo results ──
  if (packed && quiz && (phase === 'done' || phase === 'curtain') && rows.length >= quiz.questions.length) {
    const pAnswers = rows.map((r) => (r.chosen < 0 ? SKIPPED : r.chosen));
    const pTimes = rows.map((r) => Math.floor(r.ms / 100) * 100);
    if (phase === 'curtain') {
      return (
        <div className="page-shell pt-10">
          <div className="mx-auto max-w-2xl">
            <div className="skeleton" style={{ minHeight: 320 }} />
          </div>
        </div>
      );
    }
    return (
      <div className="page-shell q-page relative pt-8 lg:pt-12">
        <Confetti fire={score > packed.challengerScore} />
        <DuelResults
          payload={packed}
          questions={quiz.questions}
          playerAnswers={pAnswers}
          playerTimesMs={pTimes}
          playerScore={score}
          onRematch={() => setShowRematchSheet(true)}
          onShare={async () => {
            const url = `${window.location.origin}/quiz/duel?d=${duelParam}`;
            try {
              if (navigator.share) {
                await navigator.share({ title: 'Flag Quiz Duel', text: `Duel result: me ${score} vs ${packed.challengerName || 'them'} ${packed.challengerScore} ${url}` });
                return;
              }
            } catch {
              return;
            }
            const ok = await copy(url);
            push(ok ? 'Result link copied' : 'Copy failed');
          }}
        />
        <DuelCreateSheet
          isOpen={showRematchSheet}
          onClose={() => setShowRematchSheet(false)}
          seed={packed.seed}
          mode={packed.mode}
          difficulty={packed.difficulty}
          count={packed.count}
          score={score}
          answers={pAnswers}
          timesMs={pTimes}
        />
      </div>
    );
  }

  // ── RESULTS — the shareable moment ──
  if (phase === 'done' || phase === 'curtain') {
    return (
      <ResultsView
        quiz={quiz}
        rows={rows}
        score={score}
        correctCount={correctCount}
        total={total}
        best={best}
        accuracy={accuracy}
        isPB={isPB}
        prevBest={prevBest}
        isDaily={isDaily}
        isDuel={isDuel}
        duelName={duelName}
        duelScore={duelScore}
        expanded={expanded}
        setExpanded={setExpanded}
        share={share}
        curtain={phase === 'curtain'}
      />
    );
  }

  if (!q) return null;
  const flagOpts = isFlagOptions(q.options);
  const timedOut = phase === 'reveal' && chosen === -1;
  const secsLeft = Math.ceil((PER_QUESTION_MS - (Date.now() - startedAt)) / 1000);
  const timerPhase = secsLeft <= 3 ? 'is-red' : secsLeft <= 8 ? 'is-amber' : '';
  const results = rows.map((r) => r.correct);

  return (
    <div className="page-shell q-page pt-6 lg:pt-10">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => router.push('/quiz')} className="small-scale inline-flex min-h-[44px] items-center gap-1 font-semibold text-soft hover:text-primary" aria-label="Back to quiz hub">
            <ArrowLeft size={14} aria-hidden /> Quiz hub
          </button>
          <button
            className="icon-btn"
            onClick={() => {
              const next = !soundOn;
              setSoundOn(next);
              saveSoundPref(next);
            }}
            aria-label={soundOn ? 'Mute sound' : 'Unmute sound'}
            aria-pressed={soundOn}
            title={soundOn ? 'Sound on' : 'Sound off'}
          >
            {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        </div>

        {/* HUD: pills + score + flame */}
        <div className="q-hud" aria-label={`Question ${idx + 1} of ${total}`}>
          <ProgressPills total={total} index={idx} results={results} />
          <ScoreChip score={score} floatPts={floatPts} floatKey={floatKey} />
          <span className="relative inline-flex">
            <StreakFlame streak={streak} />
            {milestone && <SparkBurst burstKey={burstKey} n={10} />}
          </span>
        </div>
        {/* mobile segmented bar + hairline timer */}
        <div className="q-segbar mt-2" aria-hidden>
          <span style={{ transform: `scaleX(${(idx + (phase === 'reveal' ? 1 : 0)) / total})` }} />
        </div>
        {packed && quiz && (
          <div className="mt-2">
            <DuelScoreChip
              playerScore={score}
              challengerScore={getChallengerRunningScore(packed, quiz.questions, Math.max(0, rows.length - 1))}
            />
          </div>
        )}
        <div className={`q-hairline ${timerPhase}`} aria-hidden style={{ position: 'relative' }}>
          <span style={{ transform: `scaleX(${phase === 'playing' ? 1 - progress : 0})` }} />
          {packed && <GhostMarker payload={packed} index={idx} />}
        </div>
        {packed && quiz && phase === 'reveal' && (
          <p className="q-timeout">
            <GhostResultChip payload={packed} questions={quiz.questions} index={idx} />
          </p>
        )}

        <div className="q-play mt-3">
          {/* left wing (xl): live mini-stats */}
          <div className="q-wing" aria-hidden>
            <div className="q-ministat">
              <p className="small-scale font-bold uppercase tracking-[0.08em] text-soft">Accuracy</p>
              <p className="mono text-[1.2rem] font-extrabold">{rows.length ? Math.round(accuracy) : 0}%</p>
            </div>
            <div className="q-ministat">
              <p className="small-scale font-bold uppercase tracking-[0.08em] text-soft">Avg time</p>
              <p className="mono text-[1.2rem] font-extrabold">{rows.length ? `${(avgMs / 1000).toFixed(1)}s` : '—'}</p>
            </div>
            {isDuel && (
              <div className="q-ministat">
                <p className="small-scale font-bold uppercase tracking-[0.08em] text-soft">Duel</p>
                <p className="mono text-[0.85rem] font-bold">
                  You {score} · {duelName || 'Them'} {duelScore}
                </p>
              </div>
            )}
          </div>

          {/* center stage */}
          <div className={`q-stage-shell ${phase === 'reveal' && chosen === q.answer ? 'is-correct' : ''} ${tilt ? 'is-tilt' : ''}`}>
            <div aria-live="polite" className="sr-only">
              {phase === 'reveal' ? (chosen === q.answer ? 'Correct' : timedOut ? "Time's up" : 'Wrong') : ''}
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={q.id}
                initial={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: -24 }}
                transition={{ duration: DUR.base, ease: EASE_EXPO }}
              >
                {q.mode === 'country-to-flag' ? (
                  <>
                    <h1 className="q-prompt h3 mt-4">
                      <span className="q-modeglyph" aria-hidden>
                        <ModeGlyph mode={q.mode} size={20} />
                      </span>
                      {q.prompt}
                    </h1>
                    <div className="q-frame mt-3" aria-hidden style={{ opacity: 0.0, position: 'absolute', pointerEvents: 'none' }} />
                  </>
                ) : (
                  <>
                    <p className="q-prompt h3 mt-4">
                      <span className="q-modeglyph" aria-hidden>
                        <ModeGlyph mode={q.mode} size={20} />
                      </span>
                      {q.prompt}
                    </p>
                    <div className="mt-3">
                      <FlagStage code={q.code} name={q.code} streak={streak} dealKey={q.id} />
                      <TimerArc frac={phase === 'playing' ? progress : 1} />
                      <div className={`q-timerrow mt-1 flex items-center justify-end ${timerPhase}`}>
                        <span className="q-timertxt" aria-label={`${Math.max(0, secsLeft)} seconds left`}>
                          {phase === 'playing' ? `${Math.max(0, secsLeft)}s` : '—'}
                        </span>
                      </div>
                    </div>
                  </>
                )}
                {q.mode === 'country-to-flag' && (
                  <div className="mt-3">
                    <TimerArc frac={phase === 'playing' ? progress : 1} />
                    <div className={`q-timerrow mt-1 flex items-center justify-end ${timerPhase}`}>
                      <span className="q-timertxt">{phase === 'playing' ? `${Math.max(0, secsLeft)}s` : '—'}</span>
                    </div>
                  </div>
                )}

                {timedOut && (
                  <p className="q-timeout">
                    <span className="chip chip-active">Time&apos;s up!</span>
                  </p>
                )}
                {isDuel && phase === 'reveal' && !timedOut && (
                  <p className="q-timeout">
                    <span className="chip q-ghost">
                      <span className="q-diamond" aria-hidden />
                      {duelName || 'Challenger'}: {chosen === q.answer ? '✓' : '✗'} {(rows[rows.length - 1]?.ms / 1000).toFixed(1)}s
                    </span>
                  </p>
                )}

                {flagOpts ? (
                  <div className="q-mosaic" role="group" aria-label="Flag options">
                    {(q.options as FlagOption[]).map((opt, i) => {
                      const isAnswer = i === q.answer;
                      const isChosen = i === chosen;
                      let cls = 'q-tile';
                      if (phase === 'reveal') {
                        if (isAnswer) cls += ' is-correct';
                        else if (isChosen) cls += ' is-wrong';
                        else cls += ' is-dim';
                      }
                      return (
                        <motion.button
                          key={`${q.id}-${i}`}
                          onClick={() => answer(i)}
                          disabled={phase !== 'playing'}
                          className={cls}
                          aria-label={`Option ${opt.code.toUpperCase()}${phase === 'reveal' && isAnswer ? ' (correct)' : ''}`}
                          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: DUR.base, delay: i * 0.04, ease: EASE_EXPO }}
                        >
                          <img src={opt.flagUrl} alt="" loading="lazy" decoding="async" draggable={false} />
                          {phase === 'reveal' && isAnswer && (
                            <span className="q-tick" aria-hidden>
                              <Check size={15} strokeWidth={3} />
                            </span>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="q-opts" role="group" aria-label="Answer options">
                    {(q.options as string[]).map((opt, i) => {
                      const isAnswer = i === q.answer;
                      const isChosen = i === chosen;
                      let cls = 'q-opt';
                      if (phase === 'reveal') {
                        if (isAnswer) cls += ' is-correct';
                        else if (isChosen) cls += ' is-wrong';
                        else cls += ' is-dim';
                      }
                      return (
                        <motion.button
                          key={`${q.id}-${i}`}
                          onClick={() => answer(i)}
                          disabled={phase !== 'playing'}
                          className={cls}
                          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: DUR.base, delay: i * 0.04, ease: EASE_EXPO }}
                        >
                          <span className="q-key" aria-hidden>
                            {String.fromCharCode(65 + i)}
                          </span>
                          <span className="min-w-0 flex-1">{opt}</span>
                          {phase === 'reveal' && isAnswer && (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path className="q-check" d="M4 12.5l5 5L20 6.5" />
                            </svg>
                          )}
                          {phase === 'reveal' && isChosen && !isAnswer && <X size={17} aria-hidden style={{ color: 'var(--destructive)', flexShrink: 0 }} />}
                        </motion.button>
                      );
                    })}
                  </div>
                )}
                <p className="small-scale mt-3 hidden text-center text-soft lg:block">
                  Press <span className="kbd">1</span>–<span className="kbd">4</span> or <span className="kbd">A</span>–<span className="kbd">D</span> to answer,{' '}
                  <span className="kbd">Enter</span> to continue.
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* right wing (xl) */}
          <div className="q-wing" aria-hidden>
            <div className="q-ministat">
              <p className="small-scale font-bold uppercase tracking-[0.08em] text-soft">Streak</p>
              <p className="mono text-[1.2rem] font-extrabold">{streak}×</p>
            </div>
            <div className="q-ministat">
              <p className="small-scale font-bold uppercase tracking-[0.08em] text-soft">Question</p>
              <p className="mono text-[1.2rem] font-extrabold">
                {idx + 1}/{total}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultsView({
  quiz,
  rows,
  score,
  correctCount,
  total,
  best,
  accuracy,
  isPB,
  prevBest,
  isDaily,
  isDuel,
  duelName,
  duelScore,
  expanded,
  setExpanded,
  share,
  curtain,
}: {
  quiz: QuizSet;
  rows: AnswerRow[];
  score: number;
  correctCount: number;
  total: number;
  best: number;
  accuracy: number;
  isPB: boolean;
  prevBest: number;
  isDaily: boolean;
  isDuel: boolean;
  duelName: string;
  duelScore: number;
  expanded: number | null;
  setExpanded: (n: number | null) => void;
  share: (dailyNumber?: number) => void;
  curtain: boolean;
}) {
  const reduce = useReducedMotion();
  const { push } = useToast();
  const { copy } = useCopy();
  const now = useNowTick(isDaily, 1000);
  const cd = countdownToNextDailyUTC(now);
  const [dailyNumber, setDailyNumber] = useState<number | undefined>(undefined);
  const animatedScore = useCountUp(curtain ? 0 : score, 1200);
  const rank = rankForAccuracy(rows.length ? (correctCount / rows.length) * 100 : 0);
  const lastQ = quiz.questions[quiz.questions.length - 1];
  const xp = (() => {
    try {
      return loadStats().totalCorrect;
    } catch {
      return 0;
    }
  })();
  void prevBest;

  useEffect(() => {
    if (!isDaily) return;
    fetch('/api/v1/quiz/daily')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.dailyNumber) setDailyNumber(d.dailyNumber);
      })
      .catch(() => undefined);
  }, [isDaily]);

  const duelWon = isDuel ? score > duelScore : false;
  const duelTie = isDuel ? score === duelScore : false;
  const maxRace = Math.max(score, duelScore, 1);
  const [showPackedSheet, setShowPackedSheet] = useState(false);

  const copySeedLink = async () => {
    const url = `${window.location.origin}/quiz/play?mode=${encodeURIComponent(quiz.mode)}&difficulty=${encodeURIComponent(quiz.difficulty)}&count=${quiz.count}&seed=${encodeURIComponent(quiz.seed)}`;
    const ok = await copy(url);
    push(ok ? 'Seed link copied — same quiz everywhere' : 'Copy failed');
  };

  return (
    <div className="page-shell q-page relative pt-8 lg:pt-12">
      <Confetti fire={!curtain && (rank === 'S' || rank === 'A')} />
      <motion.div
        className="q-curtain mx-auto max-w-2xl"
        initial={curtain ? { opacity: 0.4, scale: 1.04 } : reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: curtain ? 0.4 : DUR.base, ease: EASE_EXPO }}
      >
        {/* screenshot-worthy summary card */}
        <section className="q-resultcard" aria-label="Quiz results">
          <RankStamp rank={rank} />
          <p className="mono text-[0.72rem] font-bold uppercase tracking-[0.12em] text-primary">
            Results{isDaily && dailyNumber ? ` · Flag Daily #${dailyNumber}` : ''} · {quiz.mode}
          </p>
          {lastQ && lastQ.mode !== 'country-to-flag' && (
            <div className="mt-4">
              <FlagStage code={lastQ.code} name={lastQ.code} streak={best} dealKey={`final-${quiz.seed}`} />
            </div>
          )}
          <p className="mono mt-4 text-[clamp(2rem,1.6rem+2vw,2.9rem)] font-extrabold leading-none" aria-live="polite">
            {animatedScore.toLocaleString('en-US')} <span className="text-soft text-[1rem] font-bold">pts</span>
          </p>
          <div className="mt-3 flex items-center justify-center gap-4">
            <AccuracyRing pct={rows.length ? (correctCount / rows.length) * 100 : 0} />
            <span className="inline-flex items-center gap-2">
              <StreakFlame streak={best} />
              <span className="small-scale text-soft">best {best}×</span>
            </span>
          </div>
          <p className="body-scale mt-2 text-soft">
            {correctCount}/{total} correct · {Math.round(accuracy)}%
          </p>
          {isPB && (
            <p className="mt-3">
              <span className="q-pb">
                <Flame size={13} aria-hidden /> NEW PERSONAL BEST
              </span>
            </p>
          )}
          <p className="mono small-scale mt-3 text-soft">
            {new Date().toISOString().slice(0, 10)} · seed {quiz.seed.slice(0, 8)}… · {quiz.difficulty}
          </p>
          {isDaily && (
            <p className="mt-2">
              <span className="chip mono">Next daily in {cd.label}</span>
            </p>
          )}
          <div className="mt-2 flex items-center justify-center gap-2">
            <LevelRing xp={xp} size={36} />
            <span className="small-scale mono text-soft">Lv {levelForXP(xp).level}</span>
          </div>
        </section>

        {/* duel race bars */}
        {isDuel && (
          <section className="card mt-4 p-5" aria-label="Duel result">
            <div className="q-poster" style={{ gridTemplateColumns: '1fr' }}>
              <div className="q-race">
                <div>
                  <p className="small-scale mb-1 font-bold">
                    You · {score.toLocaleString('en-US')} {duelWon ? '👑' : ''}
                  </p>
                  <div className="q-racetrack" role="img" aria-label={`Your score ${score}`}>
                    <motion.span
                      initial={reduce ? { scaleX: score / maxRace } : { scaleX: 0 }}
                      animate={{ scaleX: score / maxRace }}
                      transition={{ duration: 0.8, ease: EASE_EXPO }}
                    />
                  </div>
                </div>
                <div>
                  <p className="small-scale mb-1 font-bold">
                    {duelName || 'Challenger'} · {duelScore.toLocaleString('en-US')} {!duelWon && !duelTie ? '👑' : ''}
                  </p>
                  <div className="q-racetrack is-them" role="img" aria-label={`Challenger score ${duelScore}`}>
                    <motion.span
                      initial={reduce ? { scaleX: duelScore / maxRace } : { scaleX: 0 }}
                      animate={{ scaleX: duelScore / maxRace }}
                      transition={{ duration: 0.8, delay: reduce ? 0 : 0.15, ease: EASE_EXPO }}
                    />
                  </div>
                </div>
                <p className="body-scale font-bold text-primary">
                  {duelTie ? 'Tie — perfectly balanced.' : duelWon ? `You win by ${(score - duelScore).toLocaleString('en-US')}!` : `${duelName || 'Challenger'} wins by ${(duelScore - score).toLocaleString('en-US')}. Rematch?`}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* CTAs */}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href={`/quiz/play?mode=${quiz.mode}&difficulty=${quiz.difficulty}&count=${quiz.count}`} className="btn btn-primary">
            <RotateCcw size={16} aria-hidden /> Play again
          </Link>
          <Link
            href={`/quiz/duel?mode=${quiz.mode}&difficulty=${quiz.difficulty}&count=${quiz.count}&seed=${quiz.seed}&score=${score}&name=You`}
            className="btn btn-secondary"
          >
            <Swords size={16} aria-hidden /> Challenge a friend
          </Link>
          <button className="btn btn-secondary" onClick={() => setShowPackedSheet(true)}>
            <Swords size={16} aria-hidden /> Packed duel link
          </button>
          <button className="btn btn-ghost" onClick={() => share(dailyNumber)}>
            <Share2 size={16} aria-hidden /> Share
          </button>
          <button className="btn btn-ghost" onClick={copySeedLink}>
            Seed link
          </button>
          <Link href="/quiz" className="btn btn-ghost">
            <Home size={16} aria-hidden /> Hub
          </Link>
        </div>

        <DuelCreateSheet
          isOpen={showPackedSheet}
          onClose={() => setShowPackedSheet(false)}
          seed={quiz.seed}
          mode={quiz.mode}
          difficulty={quiz.difficulty}
          count={quiz.count}
          score={score}
          answers={rows.map((r) => (r.chosen < 0 ? SKIPPED : r.chosen))}
          timesMs={rows.map((r) => Math.floor(r.ms / 100) * 100)}
        />

        {/* review list */}
        <div className="q-review mt-6 text-left" aria-label="Answer review">
          {quiz.questions.map((qq, i) => {
            const r = rows[i];
            const ok = r?.correct;
            const skipped = !r || r.chosen === -1;
            const open = expanded === i;
            return (
              <motion.div
                key={qq.id}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i, 10) * 0.04, ease: EASE_EXPO }}
              >
                <button
                  className={`q-row ${skipped ? 'is-skip' : ok ? 'is-ok' : 'is-bad'}`}
                  onClick={() => setExpanded(open ? null : i)}
                  aria-expanded={open}
                  aria-label={`Question ${i + 1}: ${ok ? 'correct' : skipped ? 'skipped' : 'wrong'}. Activate to ${open ? 'collapse' : 'expand'}.`}
                >
                  <span className="mono small-scale font-bold text-soft" aria-hidden>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {qq.mode !== 'country-to-flag' ? (
                    <span className="q-miniflag" aria-hidden>
                      <FlagImage code={qq.code} name={qq.code} size="w320" aspect="3 / 2" />
                    </span>
                  ) : (
                    <span className="q-miniflag" aria-hidden style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ModeGlyph mode={qq.mode} size={18} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.85rem] font-semibold">
                      {qq.mode === 'country-to-flag' ? qq.prompt : `${qq.code.toUpperCase()} · ${qq.prompt}`}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1">
                      <span className={`q-anschip ${ok ? 'is-ok' : skipped ? '' : 'is-bad'}`}>
                        {skipped ? 'skipped' : isFlagOptions(qq.options) ? (qq.options as FlagOption[])[r.chosen]?.code.toUpperCase() ?? '—' : (qq.options as string[])[r.chosen] ?? '—'}
                      </span>
                      {!ok && (
                        <span className="q-anschip is-ok">
                          ✓ {isFlagOptions(qq.options) ? (qq.options as FlagOption[])[qq.answer].code.toUpperCase() : (qq.options as string[])[qq.answer]}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="mono small-scale text-soft" aria-hidden>
                    +{r?.points ?? 0} · {r ? `${(r.ms / 1000).toFixed(1)}s` : '—'}
                  </span>
                  <span aria-hidden>{ok ? <Check size={16} className="text-primary" /> : <X size={16} style={{ color: 'var(--destructive)' }} />}</span>
                </button>
                {open && (
                  <div className="card mt-1 space-y-1 p-3" aria-label={`All options for question ${i + 1}`}>
                    {(isFlagOptions(qq.options) ? (qq.options as FlagOption[]).map((o) => o.code.toUpperCase()) : (qq.options as string[])).map((label, oi) => (
                      <p key={oi} className={`q-anschip ${oi === qq.answer ? 'is-ok' : oi === r?.chosen ? 'is-bad' : ''}`} style={{ display: 'flex' }}>
                        {oi === qq.answer ? '✓ ' : oi === r?.chosen ? '✗ ' : '· '}
                        {label}
                      </p>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}

export default function QuizPlayPage() {
  return (
    <Suspense fallback={<div className="page-shell pt-10"><div className="skeleton" style={{ minHeight: 320 }} /></div>}>
      <PlayInner />
    </Suspense>
  );
}
