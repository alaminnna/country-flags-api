'use client';

import { ArrowUp, Search } from 'lucide-react';
import { openCommandPalette } from '@/components/command-palette';
import { ApiBaseCopy } from './api-base-copy';

const BUILD_VERSION = process.env.NEXT_PUBLIC_BUILD_VERSION || 'dev';

export function BottomBar() {
  return (
    <div className="bottom-bar">
      <div className="bottom-bar-left">
        <span className="version-chip">v{BUILD_VERSION}</span>
        <span className="text-soft">&copy; {new Date().getFullYear()} Flags API</span>
      </div>
      <div className="bottom-bar-center">
        <ApiBaseCopy />
      </div>
      <div className="bottom-bar-right">
        <button className="cmdk-chip" onClick={openCommandPalette} aria-label="Open command palette">
          <Search size={13} aria-hidden /> ⌘K
        </button>
        <button className="back-to-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Back to top">
          <ArrowUp size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}
