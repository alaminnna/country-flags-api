'use client';

import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

type Status = 'checking' | 'ok' | 'unavailable';

export function StatusPill() {
  const [status, setStatus] = useState<Status>('checking');
  const reduce = useReducedMotion();

  useEffect(() => {
    const ck = 'flags.footer.status';
    const ct = 'flags.footer.status.time';
    const cached = sessionStorage.getItem(ck);
    const at = sessionStorage.getItem(ct);
    if (cached && at && Date.now() - Number(at) < 60_000) { setStatus(cached as Status); return; }

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    fetch('/healthz', { signal: ctrl.signal })
      .then((r) => { clearTimeout(t); return r.ok ? 'ok' : 'unavailable'; })
      .catch(() => { clearTimeout(t); return 'unavailable'; })
      .then((s) => {
        setStatus(s as Status);
        sessionStorage.setItem(ck, s);
        sessionStorage.setItem(ct, String(Date.now()));
      });
    return () => { clearTimeout(t); ctrl.abort(); };
  }, []);

  const dotColor = status === 'ok' ? 'var(--primary)' : 'var(--text-secondary)';
  const label = status === 'checking' ? 'Checking...' : status === 'ok' ? 'All systems normal' : 'Status unavailable';

  return (
    <span className="status-pill" aria-label={`System status: ${label}`}>
      <span
        className={`status-dot ${status === 'ok' && !reduce ? 'is-breathing' : ''}`}
        style={{ background: dotColor }}
        aria-hidden
      />
      <span className="small-scale">{label}</span>
    </span>
  );
}
