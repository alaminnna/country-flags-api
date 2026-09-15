'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { Swords, Trophy } from 'lucide-react';
import { Button } from '@/components/ui';
import { DUR, EASE_EXPO } from '@/lib/motion';

/** Legacy seed-link pregame: ?mode & ?seed & ?score & ?name — score-only race, no packed answers. */
export function SeedPregame() {
  const sp = useSearchParams();
  const router = useRouter();
  const reduce = useReducedMotion();

  const mode = sp.get('mode') || 'mixed';
  const difficulty = sp.get('difficulty') || 'medium';
  const count = parseInt(sp.get('count') || '10', 10) || 10;
  const seed = sp.get('seed') || '';
  const score = parseInt(sp.get('score') || '0', 10) || 0;
  const name = sp.get('name') || 'Your friend';

  const accept = () => {
    router.push(
      `/quiz/play?mode=${encodeURIComponent(mode)}&difficulty=${encodeURIComponent(difficulty)}&count=${count}&seed=${encodeURIComponent(seed)}&duelName=${encodeURIComponent(name)}&duelScore=${score}`
    );
  };

  return (
    <div className="page-shell pt-8 lg:pt-12">
      <div className="mx-auto max-w-2xl text-center">
        <p className="mono text-[0.72rem] font-bold uppercase tracking-[0.12em] text-primary">
          <Swords size={14} className="mr-1 inline" aria-hidden /> Duel
        </p>
        <h1 className="h2 mt-1">{name} challenges you</h1>
        <p className="body-scale mt-2 text-soft">Same questions. Same clock.</p>

        <div className="q-poster mt-6 text-left">
          <motion.div
            className="q-duelcard is-them"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: DUR.slow, ease: EASE_EXPO }}
          >
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'var(--primary-subtle)' }} aria-hidden>
              <Trophy size={22} className="text-primary" />
            </div>
            <p className="font-bold">{name}</p>
            <p className="mono mt-1 text-2xl font-extrabold text-primary">{score.toLocaleString('en-US')}</p>
            <p className="small-scale mono mt-2 text-soft">
              {mode} · {difficulty} · {count}Q
            </p>
          </motion.div>
          <motion.div
            className="q-vs"
            aria-hidden
            initial={reduce ? { opacity: 0 } : { scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: DUR.slow, ease: EASE_EXPO, delay: 0.15 }}
          >
            VS
          </motion.div>
          <motion.div
            className="q-duelcard is-you"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: DUR.slow, ease: EASE_EXPO, delay: 0.2 }}
          >
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold text-soft" style={{ background: 'var(--surface-muted)' }} aria-hidden>
              ?
            </div>
            <p className="font-bold">You</p>
            <p className="mono mt-1 text-2xl font-extrabold text-soft">—</p>
            <p className="small-scale mono mt-2 text-soft">{count} questions</p>
          </motion.div>
        </div>

        <div className="mt-6">
          <Button size="lg" className="w-full min-h-[48px] text-lg sm:w-auto sm:min-w-[280px]" onClick={accept}>
            Accept <Swords size={18} aria-hidden className="ml-1 inline" />
          </Button>
        </div>
      </div>
    </div>
  );
}
