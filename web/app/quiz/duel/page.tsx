'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Swords } from 'lucide-react';
import { DuelPregame } from '@/components/duel/pregame';
import { SeedPregame } from '@/components/duel/seed-pregame';
import { DuelResultView } from '@/components/duel/duel-result-view';
import { decodeDuel } from '@/lib/duel/codec';
import { getCompletedDuel } from '@/lib/duel/storage';
import { Button } from '@/components/ui';

function DuelPoster() {
  return (
    <div className="page-shell pt-8 lg:pt-12">
      <div className="mx-auto max-w-2xl text-center">
        <p className="mono text-[0.72rem] font-bold uppercase tracking-[0.12em] text-primary">
          <Swords size={14} className="mr-1 inline" aria-hidden /> Duel mode
        </p>
        <h1 className="h2 mt-1">Challenge a friend</h1>
        <p className="body-scale mt-2 text-soft">
          Play any quiz, share the link — the seed replays the identical quiz on their device. Highest score wins.
        </p>
        <div className="q-poster mt-6 text-left">
          <div className="q-duelcard is-you">
            <p className="font-bold">1. Play</p>
            <p className="small-scale mt-1 text-soft">Finish any quiz — daily, mixed, expert.</p>
          </div>
          <div className="q-vs" aria-hidden>
            VS
          </div>
          <div className="q-duelcard is-them">
            <p className="font-bold">2. Share</p>
            <p className="small-scale mt-1 text-soft">Hit “Challenge a friend” on results. Send the link.</p>
          </div>
        </div>
        <p className="small-scale mt-4 text-soft">
          Packed duel links carry per-question answers and times for ghost markers and a full head-to-head replay.
          Seed links carry the score for a quick race. Both are stateless — the link is the transport.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button href="/quiz" size="lg" className="min-h-[48px]">
            Pick a quiz
          </Button>
          <Link href="/quiz/play?mode=mixed&difficulty=medium&count=10" className="btn btn-secondary btn-lg min-h-[48px]">
            Quick random duel quiz
          </Link>
        </div>
      </div>
    </div>
  );
}

function DuelPageInner() {
  const searchParams = useSearchParams();
  const d = searchParams.get('d');
  const seed = searchParams.get('seed') || '';
  const [completed, setCompleted] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!d) {
      setChecked(true);
      return;
    }
    try {
      const decoded = decodeDuel(d);
      if (getCompletedDuel(decoded.checksum)) setCompleted(true);
    } catch {
      // decode errors surface in pregame
    }
    setChecked(true);
  }, [d]);

  if (d) {
    if (!checked) {
      return (
        <div className="page-shell pt-10">
          <div className="mx-auto max-w-2xl">
            <div className="skeleton" style={{ minHeight: 320 }} />
          </div>
        </div>
      );
    }
    if (completed) return <DuelResultView encoded={d} />;
    return <DuelPregame encoded={d} />;
  }

  if (seed) return <SeedPregame />;

  return <DuelPoster />;
}

export default function DuelPage() {
  return (
    <Suspense
      fallback={
        <div className="page-shell pt-10">
          <div className="mx-auto max-w-2xl">
            <div className="skeleton" style={{ minHeight: 320 }} />
          </div>
        </div>
      }
    >
      <DuelPageInner />
    </Suspense>
  );
}
