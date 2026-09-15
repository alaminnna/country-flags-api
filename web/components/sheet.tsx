'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { DUR, EASE_EXPO } from '../lib/motion';
import { useIsMobile } from '../lib/hooks';

/**
 * Sheet — bottom sheet on mobile (drag-to-dismiss with spring physics
 * + grab handle), centered modal on desktop. One component, both contexts.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const sheetMotion = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0 } }
    : isMobile
      ? {
          initial: { y: '100%' },
          animate: { y: 0 },
          exit: { y: '100%' },
        }
      : {
          initial: { opacity: 0, scale: 0.96, y: 12 },
          animate: { opacity: 1, scale: 1, y: 0 },
          exit: { opacity: 0, scale: 0.96, y: 12 },
        };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="sheet-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={(e) => e.stopPropagation()}
            {...sheetMotion}
            transition={
              reduce
                ? { duration: 0.01 }
                : isMobile
                  ? { type: 'spring', stiffness: 320, damping: 34 }
                  : { duration: DUR.base, ease: EASE_EXPO }
            }
            drag={reduce || !isMobile ? false : 'y'}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 550) onClose();
            }}
          >
            <div className="sheet-grab" aria-hidden />
            <div className="flex items-center gap-2 px-5 pb-1 pt-2">
              <h2 className="text-[1rem] font-bold tracking-tight">{title}</h2>
              <button className="icon-btn ml-auto" style={{ width: 40, height: 40 }} onClick={onClose} aria-label="Close dialog">
                <X size={18} />
              </button>
            </div>
            <div className="sheet-body">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
