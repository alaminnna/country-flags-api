'use client';

import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Swords, Copy, Share2, X, Link as LinkIcon } from 'lucide-react';
import { decodeDuel, encodeDuel } from '@/lib/duel/codec';
import { recordCreatedDuel } from '@/lib/duel/storage';
import { DuelPayload } from '@/lib/duel/types';
import { Button } from '@/components/ui';
import { useCopy } from '@/lib/hooks';
import { useToast } from '@/components/toast';
import { EASE_EXPO, DUR } from '@/lib/motion';

interface DuelCreateSheetProps {
  isOpen: boolean;
  onClose: () => void;
  seed: bigint | string;
  mode: string;
  difficulty: string;
  count: number;
  score: number;
  answers: number[];
  timesMs: number[];
}

export function DuelCreateSheet({
  isOpen,
  onClose,
  seed,
  mode,
  difficulty,
  count,
  score,
  answers,
  timesMs,
}: DuelCreateSheetProps) {
  const [name, setName] = useState('');
  const [duelLink, setDuelLink] = useState<string | null>(null);
  const { copy } = useCopy();
  const { push } = useToast();
  const reduce = useReducedMotion();

  const handleCreate = () => {
    try {
      const payload: Omit<DuelPayload, 'checksum'> = {
        version: 0x01,
        seed: BigInt(seed),
        mode: mode as DuelPayload['mode'],
        difficulty: difficulty as DuelPayload['difficulty'],
        count: count as DuelPayload['count'],
        challengerScore: score,
        challengerName: name.trim().slice(0, 24),
        answers,
        timesMs: timesMs.map((t) => Math.floor(t / 100) * 100),
      };
      const encoded = encodeDuel(payload);
      setDuelLink(encoded);
      const full = decodeDuel(encoded);
      recordCreatedDuel({
        checksum: full.checksum,
        seed: full.seed,
        mode: full.mode,
        difficulty: full.difficulty,
        count: full.count,
        challengerName: full.challengerName,
        challengerScore: full.challengerScore,
        createdAt: Date.now(),
      });
    } catch {
      push('Could not create duel link');
    }
  };

  const shareText = () => {
    const url = `${window.location.origin}/quiz/duel?d=${duelLink}`;
    return `I scored ${score} in Flag Quiz (${difficulty} · ${count}Q). Beat me \u2694\uFE0F ${url}`;
  };

  const handleShare = async () => {
    if (!duelLink) return;
    const text = shareText();
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Flag Quiz Duel', text });
        return;
      }
    } catch {
      return;
    }
    const ok = await copy(text);
    push(ok ? 'Challenge copied — send it to a friend' : 'Copy failed');
  };

  const handleCopyLink = async () => {
    if (!duelLink) return;
    const url = `${window.location.origin}/quiz/duel?d=${duelLink}`;
    const ok = await copy(url);
    push(ok ? 'Link copied' : 'Copy failed');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(0,0,0,0.5)' }}
          />
          <motion.div
            initial={reduce ? { opacity: 0 } : { y: '100%' }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { y: '100%' }}
            transition={{ duration: DUR.slow, ease: EASE_EXPO }}
            className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-t-2xl p-6"
            style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}
            role="dialog"
            aria-label="Challenge a friend"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xl font-bold">
                <Swords size={20} className="text-primary" aria-hidden />
                Challenge a friend
              </h2>
              <button
                onClick={onClose}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg hover:opacity-70"
                style={{ background: 'var(--surface-muted)' }}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {!duelLink ? (
              <div className="space-y-4">
                <div>
                  <label htmlFor="duel-name" className="small-scale mb-1 block font-semibold text-soft">
                    Your name (optional)
                  </label>
                  <input
                    id="duel-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value.slice(0, 24))}
                    placeholder="Anonymous"
                    maxLength={24}
                    className="w-full rounded-xl px-4 py-3"
                    style={{
                      background: 'var(--surface-muted)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <div className="small-scale mt-1 text-right text-soft">{name.length}/24</div>
                </div>
                <Button onClick={handleCreate} size="lg" className="w-full min-h-[48px]">
                  <LinkIcon size={16} aria-hidden /> Create duel link
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="small-scale text-center text-soft">
                  Same questions. Same clock. Link is under 200 chars — SMS/WhatsApp-safe.
                </p>
                <Button onClick={handleShare} size="lg" className="w-full min-h-[48px]">
                  <Share2 size={16} aria-hidden /> Share challenge
                </Button>
                <Button onClick={handleCopyLink} variant="secondary" className="w-full min-h-[44px]">
                  <Copy size={16} aria-hidden /> Copy link only
                </Button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
