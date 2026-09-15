'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { DUR, EASE_EXPO } from '../lib/motion';

type ToastItem = { id: number; message: string };

const ToastCtx = createContext<{ push: (message: string) => void }>({ push: () => {} });

export const useToast = () => useContext(ToastCtx);

/**
 * ToastProvider — bottom-right stacked toasts, green accent border,
 * auto-dismiss with a thin progress bar.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const reduce = useReducedMotion();

  const push = useCallback((message: string) => {
    idRef.current += 1;
    const id = idRef.current;
    setToasts((prev) => [...prev.slice(-2), { id, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3050);
  }, []);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="false">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              className="toast"
              role="status"
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: 32 }}
              transition={{ duration: DUR.base, ease: EASE_EXPO }}
              layout
            >
              <span className="toast-icon" aria-hidden>
                <CheckCircle2 size={17} />
              </span>
              <span>{t.message}</span>
              <span className="toast-progress" aria-hidden />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
