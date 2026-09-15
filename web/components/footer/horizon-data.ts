import { useState, useEffect } from 'react';

export type CountryTile = { code: string; name: string };

let cache: CountryTile[] | null = null;

export function useHorizonCountries(): CountryTile[] {
  const [countries, setCountries] = useState<CountryTile[]>(cache ?? []);

  useEffect(() => {
    if (cache) { setCountries(cache); return; }
    fetch('/api/v1/countries')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { code: string; name: string }[] | null) => {
        if (data) { cache = data.map((c) => ({ code: c.code, name: c.name })); setCountries(cache); }
      })
      .catch(() => {});
  }, []);

  return countries;
}

export function useInView(ref: React.RefObject<HTMLElement | null>, margin = 600): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } },
      { rootMargin: `${margin}px` },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, margin]);
  return inView;
}
