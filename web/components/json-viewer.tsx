'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronRight, FileJson } from 'lucide-react';
import { CopyButton } from './copy-button';

function Primitive({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="tok-null">null</span>;
  if (typeof value === 'string') return <span className="tok-str">“{value}”</span>;
  if (typeof value === 'number') return <span className="tok-num">{String(value)}</span>;
  if (typeof value === 'boolean') return <span className="tok-bool">{String(value)}</span>;
  return <span className="tok-str">{String(value)}</span>;
}

function JsonNode({
  name,
  value,
  depth,
  path,
  collapsed,
  toggle,
}: {
  name?: string;
  value: unknown;
  depth: number;
  path: string;
  collapsed: Set<string>;
  toggle: (p: string) => void;
}) {
  const isObj = typeof value === 'object' && value !== null;
  if (!isObj) {
    return (
      <div className="json-row">
        <span>
          {name !== undefined && (
            <>
              <span className="tok-key">{name}</span>
              <span className="tok-punct">: </span>
            </>
          )}
          <Primitive value={value} />
        </span>
      </div>
    );
  }

  const entries = Object.entries(value as Record<string, unknown>);
  const isArr = Array.isArray(value);
  const isCollapsed = collapsed.has(path);
  const open = isArr ? '[' : '{';
  const close = isArr ? ']' : '}';
  const summary = isArr ? `${entries.length} items` : `${entries.length} keys`;

  return (
    <div>
      <div className="json-row">
        <button className="json-toggle" onClick={() => toggle(path)} aria-label={isCollapsed ? `Expand ${name ?? 'root'}` : `Collapse ${name ?? 'root'}`} aria-expanded={!isCollapsed}>
          {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
        </button>
        <span>
          {name !== undefined && (
            <>
              <span className="tok-key">{name}</span>
              <span className="tok-punct">: </span>
            </>
          )}
          <span className="tok-punct">{open}</span>
          {isCollapsed && (
            <span className="tok-null">
              {' '}
              … {summary} <span className="tok-punct">{close}</span>
            </span>
          )}
        </span>
      </div>
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ paddingLeft: depth === 0 ? 0 : 18 }}>
              {entries.map(([k, v]) => (
                <JsonNode
                  key={k}
                  name={isArr ? undefined : k}
                  value={v}
                  depth={depth + 1}
                  path={`${path}.${k}`}
                  collapsed={collapsed}
                  toggle={toggle}
                />
              ))}
            </div>
            <div className="json-row" style={{ paddingLeft: depth === 0 ? 16 : 34 }}>
              <span className="tok-punct">{close}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * JsonViewer — syntax-highlighted, collapsible, copyable.
 * Containers at depth ≥ 2 start collapsed.
 */
export function JsonViewer({ data, title = 'response.json' }: { data: unknown; title?: string }) {
  const initial = useMemo(() => {
    const set = new Set<string>();
    const walk = (v: unknown, path: string, depth: number) => {
      if (typeof v === 'object' && v !== null) {
        if (depth >= 2) set.add(path);
        for (const [k, child] of Object.entries(v as Record<string, unknown>)) walk(child, `${path}.${k}`, depth + 1);
      }
    };
    walk(data, 'root', 0);
    return set;
  }, [data]);

  const [collapsed, setCollapsed] = useState<Set<string>>(initial);

  const toggle = (p: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });

  return (
    <div className="json-viewer">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="text-soft" aria-hidden>
          <FileJson size={15} />
        </span>
        <span className="mono text-[0.75rem] font-semibold text-soft">{title}</span>
        <span className="ml-auto">
          <CopyButton text={JSON.stringify(data, null, 2)} label="Copy JSON" showLabel />
        </span>
      </div>
      <div className="max-h-[480px] overflow-auto py-2">
        <JsonNode value={data} depth={0} path="root" collapsed={collapsed} toggle={toggle} />
      </div>
    </div>
  );
}
