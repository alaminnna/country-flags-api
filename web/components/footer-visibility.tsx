'use client';

import { useEffect, useState } from 'react';

export function FooterVisibility({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const check = () => setHidden(document.body.dataset.footerHidden === 'true');
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.body, { attributes: true, attributeFilter: ['data-footer-hidden'] });
    return () => obs.disconnect();
  }, []);

  if (hidden) return null;
  return <>{children}</>;
}
