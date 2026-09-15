'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CopyButton } from './copy-button';

export type CodeTab = { label: string; code: string };

/**
 * CodeBlock — mock window with traffic-light dots, tabbed languages,
 * copy button with morph icon→checkmark. Green left accent on active tab.
 */
export function CodeBlock({ tabs, title }: { tabs: CodeTab[]; title?: string }) {
  const [active, setActive] = useState(0);
  const tab = tabs[Math.min(active, tabs.length - 1)];

  return (
    <div className="code-window">
      <div className="code-chrome">
        <span className="code-dots" aria-hidden>
          <span />
          <span />
          <span />
        </span>
        {title && <span className="mono hidden text-[0.72rem] font-semibold text-soft sm:inline">{title}</span>}
        <div className="code-tabs" role="tablist" aria-label="Code language">
          {tabs.map((t, i) => (
            <button
              key={t.label}
              role="tab"
              aria-selected={i === active}
              className={`code-tab ${i === active ? 'is-active' : ''}`}
              onClick={() => setActive(i)}
            >
              {i === active && <span className="code-tab-accent" aria-hidden />}
              {t.label}
            </button>
          ))}
        </div>
        <span className="ml-auto">
          <CopyButton text={tab.code} label={`Copy ${tab.label} snippet`} />
        </span>
      </div>
      <div className="code-body">
        <motion.pre
          key={`${tab.label}-${tab.code.length}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {tab.code}
        </motion.pre>
      </div>
    </div>
  );
}
