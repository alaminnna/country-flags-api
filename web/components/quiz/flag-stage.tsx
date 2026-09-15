'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { DUR, EASE_EXPO } from '../../lib/motion';
import { FlagImage } from '../flag-image';

/**
 * FlagStage — the performer frame. Fixed-ratio tile (4:3 desktop, 16:10 mobile),
 * --surface fill, --border, edge-light hairline, radius-lg, soft radial spotlight
 * BEHIND the frame that intensifies with streak. Transparent flags never float naked.
 * Transform/opacity only. All colors via tokens.
 */
export function FlagStage({
  code,
  name,
  streak = 0,
  dealKey,
  tall = false,
}: {
  code: string;
  name: string;
  streak?: number;
  dealKey: string | number;
  tall?: boolean;
}) {
  const reduce = useReducedMotion();
  const hot = streak >= 5;
  // spotlight intensity 0.06 → 0.10, + streak boost (hot rim)
  const glow = streak >= 8 ? 0.16 : streak >= 5 ? 0.12 : streak >= 3 ? 0.1 : 0.07;

  return (
    <div className={`q-stage ${hot ? 'is-hot' : ''} ${tall ? 'is-tall' : ''}`} data-streak={streak}>
      <div
        className="q-spotlight"
        aria-hidden
        style={{ opacity: 1, ['--spot' as string]: glow }}
      />
      <motion.div
        key={dealKey}
        className="q-frame"
        initial={reduce ? { opacity: 0 } : { opacity: 0, rotateY: 90 }}
        animate={{ opacity: 1, rotateY: 0 }}
        transition={{ duration: 0.25, ease: EASE_EXPO }}
        style={{ transformPerspective: 900 }}
      >
        <FlagImage code={code} name={name} size="w320" eager fit="contain" aspect="4 / 3" className="q-flagimg" />
      </motion.div>
    </div>
  );
}

/** Tiny stage tilt of disapproval wrapper — parent applies .is-tilt for 350ms on wrong. */
export function StageShell({ children }: { children: React.ReactNode }) {
  return <div className="q-stage-shell">{children}</div>;
}

export const DEAL_MS = 250;
export const __stageTokens = { DUR, EASE_EXPO };
