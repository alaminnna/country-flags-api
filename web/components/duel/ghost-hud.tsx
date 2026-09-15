'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { DuelPayload, SKIPPED } from '@/lib/duel/types';
import { QuizQuestion, scoreQuestion } from '@/lib/quiz';
import { DUR, EASE_EXPO } from '@/lib/motion';

export const PER_QUESTION_MS = 15000;

export function isChallengerCorrect(
  payload: DuelPayload,
  questions: QuizQuestion[],
  index: number
): boolean {
  const q = questions[index];
  if (!q) return false;
  const a = payload.answers[index];
  if (a === SKIPPED) return false;
  return a === q.answer;
}

export function getChallengerRunningScore(
  payload: DuelPayload,
  questions: QuizQuestion[],
  upToIndex: number
): number {
  let score = 0;
  let streak = 0;
  const n = Math.min(upToIndex, payload.count - 1, questions.length - 1);
  for (let i = 0; i <= n; i++) {
    const correct = isChallengerCorrect(payload, questions, i);
    if (correct) {
      streak += 1;
      score += scoreQuestion(true, payload.timesMs[i], streak);
    } else {
      streak = 0;
    }
  }
  return score;
}

export function GhostMarker({
  payload,
  index,
}: {
  payload: DuelPayload;
  index: number;
}) {
  const reduce = useReducedMotion();
  const t = payload.timesMs[index] ?? PER_QUESTION_MS;
  const skipped = payload.answers[index] === SKIPPED;
  const leftPct = Math.max(0, Math.min(100, (t / PER_QUESTION_MS) * 100));

  return (
    <motion.span
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: DUR.fast, ease: EASE_EXPO }}
      title={skipped ? 'They timed out' : `They answered at ${(t / 1000).toFixed(1)}s`}
      aria-hidden
      style={{
        position: 'absolute',
        top: '50%',
        left: `${leftPct}%`,
        width: 10,
        height: 10,
        transform: 'translate(-50%, -50%) rotate(45deg)',
        background: 'var(--primary)',
        borderRadius: 2,
        pointerEvents: 'none',
      }}
    />
  );
}

export function GhostResultChip({
  payload,
  questions,
  index,
}: {
  payload: DuelPayload;
  questions: QuizQuestion[];
  index: number;
}) {
  const reduce = useReducedMotion();
  const correct = isChallengerCorrect(payload, questions, index);
  const t = payload.timesMs[index] ?? 0;
  const name = payload.challengerName || 'Friend';

  return (
    <motion.span
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: DUR.fast, ease: EASE_EXPO }}
      className="chip"
      style={
        correct
          ? { background: 'var(--primary-subtle)', color: 'var(--primary)' }
          : { background: 'rgba(220,38,38,0.1)', color: 'var(--destructive)' }
      }
    >
      {name}: {correct ? '\u2713' : '\u2717'} {(t / 1000).toFixed(1)}s
    </motion.span>
  );
}

export function DuelScoreChip({
  playerScore,
  challengerScore,
}: {
  playerScore: number;
  challengerScore: number;
}) {
  return (
    <div className="mono flex items-center justify-between text-[0.8rem] font-bold" aria-live="polite">
      <span className={playerScore >= challengerScore ? 'text-primary' : 'text-soft'}>
        You {playerScore}
      </span>
      <span className="text-soft" aria-hidden>
        ·
      </span>
      <span className={challengerScore > playerScore ? 'text-primary' : 'text-soft'}>
        Them {challengerScore}
      </span>
    </div>
  );
}
