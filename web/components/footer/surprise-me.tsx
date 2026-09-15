'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Shuffle } from 'lucide-react';

let countriesCache: { code: string }[] | null = null;

export function SurpriseMe() {
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);
  const iconRef = useRef<SVGSVGElement>(null);

  const handleClick = async () => {
    if (spinning) return;
    setSpinning(true);
    if (iconRef.current) {
      iconRef.current.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
      iconRef.current.style.transform = 'rotate(180deg)';
    }
    try {
      if (!countriesCache) {
        const r = await fetch('/api/v1/countries');
        if (r.ok) countriesCache = await r.json();
      }
      if (countriesCache?.length) {
        const pick = countriesCache[Math.floor(Math.random() * countriesCache.length)];
        setTimeout(() => router.push(`/country/${pick.code}`), 200);
        return;
      }
    } catch {}
    setTimeout(() => router.push('/explore'), 200);
  };

  return (
    <button className="surprise-btn" onClick={handleClick} aria-label="Surprise me — visit a random country">
      <Shuffle
        ref={iconRef}
        size={14}
        aria-hidden
        onTransitionEnd={() => { setSpinning(false); if (iconRef.current) iconRef.current.style.transform = ''; }}
      />
      Surprise me
    </button>
  );
}
