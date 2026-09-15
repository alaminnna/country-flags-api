'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { DUR, EASE_EXPO } from '../lib/motion';

// module flag: first mount = initial page load (SSR HTML already painted),
// so skip the entrance and let LCP land instantly; animate on later navigations.
let hasMountedOnce = false;

/** page transitions: 250ms fade + 8px rise on every route change */
export default function Template({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const [firstLoad] = useState(() => !hasMountedOnce);
  useEffect(() => {
    hasMountedOnce = true;
  }, []);

  if (firstLoad || reduce) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: firstLoad ? 0.01 : DUR.base }}>
        {children}
      </motion.div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR.base, ease: EASE_EXPO }}
    >
      {children}
    </motion.div>
  );
}
