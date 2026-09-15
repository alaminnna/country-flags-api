'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { Swords, Copy, Trophy } from 'lucide-react';
import { decodeDuel, DuelCodecError } from '@/lib/duel/codec';
import { isOwnDuel } from '@/lib/duel/storage';
import { DuelPayload } from '@/lib/duel/types';
import { Button, Chip, ErrorState } from '@/components/ui';
import { useCopy } from '@/lib/hooks';
import { useToast } from '@/components/toast';
import { EASE_EXPO, DUR } from '@/lib/motion';

export function DuelPregame({ encoded }: { encoded: string }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [payload, setPayload] = useState<DuelPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOwn, setIsOwn] = useState(false);
  const { copy } = useCopy();
  const { push } = useToast();

  useEffect(() => {
    try {
      const decoded = decodeDuel(encoded);
      setPayload(decoded);
      if (isOwnDuel(decoded.checksum)) {
        setIsOwn(true);
      }
    } catch (e) {
      setError(e instanceof DuelCodecError ? e.message : 'Failed to load duel');
    }
  }, [encoded]);

  if (error) {
    return (
      <div className="page-shell pt-10">
        <ErrorState title="Invalid duel link" hint="Ask your friend to resend the link." />
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="page-shell pt-10">
        <div className="mx-auto max-w-2xl">
          <div className="skeleton" style={{ minHeight: 320 }} />
        </div>
      </div>
    );
  }

  if (isOwn) {
    return (
      <div className="page-shell pt-10">
        <div className="mx-auto max-w-sm text-center">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: 'var(--primary-subtle)' }}
            aria-hidden
          >
            <Copy size={28} className="text-primary" />
          </div>
          <h1 className="h2">This is your challenge</h1>
          <p className="body-scale mt-2 text-soft">Share this link with a friend to duel them.</p>
          <div className="mt-6">
            <Button
              size="lg"
              className="w-full min-h-[44px]"
              onClick={async () => {
                const url = `${window.location.origin}/quiz/duel?d=${encoded}`;
                const ok = await copy(url);
                push(ok ? 'Challenge link copied' : 'Copy failed');
              }}
            >
              <Copy size={16} aria-hidden /> Copy link
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const challengerName = payload.challengerName || 'Your friend';
  const playUrl = `/quiz/play?mode=${encodeURIComponent(payload.mode)}&difficulty=${encodeURIComponent(
    payload.difficulty
  )}&count=${payload.count}&seed=${payload.seed.toString()}&d=${encodeURIComponent(encoded)}`;

  const anim = (delay: number) =>
    reduce ? { initial: { opacity: 0 }, animate: { opacity: 1 } } : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } };

  return (
    <div className="page-shell pt-8 lg:pt-12">
      <div className="mx-auto max-w-lg">
        <motion.div {...anim(0)} transition={{ duration: DUR.base, ease: EASE_EXPO }} className="text-center">
          <p className="mono text-[0.72rem] font-bold uppercase tracking-[0.12em] text-primary">
            <Swords size={14} className="mr-1 inline" aria-hidden /> Duel
          </p>
          <h1 className="h2 mt-1">{challengerName} challenges you</h1>
          <p className="body-scale mt-2 text-soft">Same questions. Same clock.</p>
        </motion.div>

        <div className="mt-6 flex items-stretch gap-3">
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: DUR.slow, ease: EASE_EXPO, delay: 0.1 }}
            className="card flex-1 p-5 text-center"
          >
            <div
              className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: 'var(--primary-subtle)' }}
              aria-hidden
            >
              <Trophy size={26} className="text-primary" />
            </div>
            <div className="text-[0.95rem] font-bold">{challengerName}</div>
            <div className="mono mt-1 text-3xl font-bold text-primary">{payload.challengerScore}</div>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              <Chip>{payload.mode}</Chip>
              <Chip>{payload.difficulty}</Chip>
              <Chip>{payload.count}Q</Chip>
            </div>
          </motion.div>

          <motion.div
            initial={reduce ? { opacity: 0 } : { scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 1 }}
            transition={{ duration: DUR.slow, ease: EASE_EXPO, delay: 0.2 }}
            className="flex flex-col items-center justify-center gap-2"
            aria-hidden
          >
            <div className="w-px flex-1" style={{ background: 'var(--border)' }} />
            <Swords size={20} className="text-primary" />
            <div className="w-px flex-1" style={{ background: 'var(--border)' }} />
          </motion.div>

          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: DUR.slow, ease: EASE_EXPO, delay: 0.3 }}
            className="card flex-1 border-dashed p-5 text-center"
          >
            <div
              className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold text-soft"
              style={{ background: 'var(--surface-muted)' }}
              aria-hidden
            >
              ?
            </div>
            <div className="text-[0.95rem] font-bold text-soft">You</div>
            <div className="mono mt-1 text-3xl font-bold text-soft">—</div>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              <Chip>{payload.count} questions</Chip>
            </div>
          </motion.div>
        </div>

        <motion.div {...anim(0)} transition={{ duration: DUR.base, ease: EASE_EXPO, delay: 0.4 }} className="mt-6">
          <Button size="lg" className="w-full min-h-[48px] text-lg" onClick={() => router.push(playUrl)}>
            Accept <Swords size={18} aria-hidden className="ml-1 inline" />
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
