'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Copy } from 'lucide-react';
import { useCopy } from '../lib/hooks';

/**
 * CopyButton — icon morphs to a green checkmark + "Copied" micro-toast.
 * Everything copyable in the app uses this.
 */
export function CopyButton({
  text,
  label = 'Copy',
  showLabel = false,
  className = '',
  onCopied,
}: {
  text: string;
  label?: string;
  showLabel?: boolean;
  className?: string;
  onCopied?: (text: string) => void;
}) {
  const { copied, copy } = useCopy();
  const reduce = useReducedMotion();

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const ok = await copy(text);
    if (ok) onCopied?.(text);
  };

  const iconMotion = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, scale: 0.5, rotate: -45 },
        animate: { opacity: 1, scale: 1, rotate: 0 },
        exit: { opacity: 0, scale: 0.5, rotate: 45 },
      };

  return (
    <button
      type="button"
      className={`copy-btn ${copied ? 'is-copied' : ''} ${className}`.trim()}
      onClick={onClick}
      aria-label={copied ? 'Copied' : label}
      aria-live="polite"
      title={copied ? 'Copied' : label}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={copied ? 'check' : 'copy'}
          {...iconMotion}
          transition={{ duration: 0.15 }}
          style={{ display: 'inline-flex' }}
        >
          {copied ? <Check size={15} strokeWidth={2.75} /> : <Copy size={15} />}
        </motion.span>
      </AnimatePresence>
      {showLabel && <span>{copied ? 'Copied' : label}</span>}
      <AnimatePresence>
        {copied && (
          <motion.span
            className="copy-micro"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            Copied
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
