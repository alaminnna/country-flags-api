'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { decodeDuel } from '@/lib/duel/codec';
import { getCompletedDuel, isOwnDuel } from '@/lib/duel/storage';
import { DuelResult } from '@/lib/duel/types';
import { fetchQuestions, QuizSet } from '@/lib/quiz';
import { DuelResults } from './results';
import { DuelCreateSheet } from './create-sheet';
import { ErrorState } from '@/components/ui';
import { useCopy } from '@/lib/hooks';
import { useToast } from '@/components/toast';

export function DuelResultView({ encoded }: { encoded: string }) {
  const router = useRouter();
  const [result, setResult] = useState<DuelResult | null>(null);
  const [questions, setQuestions] = useState<QuizSet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRematch, setShowRematch] = useState(false);
  const { copy } = useCopy();
  const { push } = useToast();

  useEffect(() => {
    try {
      const decoded = decodeDuel(encoded);
      const stored = getCompletedDuel(decoded.checksum);
      if (!stored) {
        setError('Duel result not found on this device.');
        return;
      }
      // JSON round-trip loses bigint seed — restore from payload
      const fixed: DuelResult = {
        ...stored,
        payload: { ...stored.payload, seed: BigInt((stored.payload.seed as unknown as string | number | bigint).toString()) },
      };
      // Restore meta seed too if needed (not used here)
      setResult(fixed);
      fetchQuestions({
        mode: fixed.payload.mode,
        difficulty: fixed.payload.difficulty,
        count: fixed.payload.count,
        seed: fixed.payload.seed.toString(),
      }).then((qs) => {
        if (qs) setQuestions(qs);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load duel result');
    }
  }, [encoded]);

  if (error) {
    return (
      <div className="page-shell pt-10">
        <ErrorState title="Duel result unavailable" hint={error} />
      </div>
    );
  }

  if (!result || !questions) {
    return (
      <div className="page-shell pt-10">
        <div className="mx-auto max-w-2xl">
          <div className="skeleton" style={{ minHeight: 320 }} />
        </div>
      </div>
    );
  }

  const wasOwnOriginal = isOwnDuel(result.payload.checksum);

  return (
    <div className="page-shell pt-8 lg:pt-12">
      {wasOwnOriginal && (
        <div className="card mx-auto mb-6 max-w-2xl border p-4 text-center" style={{ borderColor: 'var(--primary)' }}>
          <p className="text-[0.9rem] font-bold text-primary">Rematch complete</p>
          <p className="small-scale text-soft">Your friend answered your challenge. Full comparison below.</p>
        </div>
      )}
      <DuelResults
        payload={result.payload}
        questions={questions.questions}
        playerAnswers={result.playerAnswers}
        playerTimesMs={result.playerTimesMs}
        playerScore={result.playerScore}
        onRematch={() => setShowRematch(true)}
        onShare={async () => {
          const url = `${window.location.origin}/quiz/duel?d=${encoded}`;
          try {
            if (navigator.share) {
              await navigator.share({ title: 'Flag Quiz Duel', text: `Duel result: ${result.playerScore} vs ${result.payload.challengerScore} ${url}` });
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
        isOpen={showRematch}
        onClose={() => setShowRematch(false)}
        seed={result.payload.seed}
        mode={result.payload.mode}
        difficulty={result.payload.difficulty}
        count={result.payload.count}
        score={result.playerScore}
        answers={result.playerAnswers}
        timesMs={result.playerTimesMs}
      />
    </div>
  );
}
