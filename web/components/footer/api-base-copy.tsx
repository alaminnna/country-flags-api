'use client';

import { Copy, Check } from 'lucide-react';
import { useState, useCallback } from 'react';
import { useToast } from '@/components/toast';

export function ApiBaseCopy() {
  const [copied, setCopied] = useState(false);
  const { push } = useToast();
  const apiBase = typeof window !== 'undefined' ? `${window.location.origin}/api/v1` : '/api/v1';

  const handleCopy = useCallback(async () => {
    try { await navigator.clipboard.writeText(apiBase); setCopied(true); push('API base copied'); setTimeout(() => setCopied(false), 1600); } catch { push('Copy failed'); }
  }, [apiBase, push]);

  return (
    <span className="api-base-row">
      <code className="api-base-chip">{apiBase}</code>
      <button className="copy-icon-btn" onClick={handleCopy} aria-label={copied ? 'Copied' : 'Copy API base URL'}>
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </span>
  );
}
