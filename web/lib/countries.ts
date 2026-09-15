import { Country, fetchJSON } from './api';

/**
 * In-memory cache for the country list. Every page calls getCountries()
 * instead of firing its own fetch — /api/v1/countries is fetched once
 * per session and shared (explore, palette, compare, country prev/next).
 */

let cache: Country[] | null = null;
let inflight: Promise<Country[]> | null = null;

export function getCountries(): Promise<Country[]> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = fetchJSON<Country[]>('/api/v1/countries')
    .then((list) => {
      cache = Array.isArray(list) ? list : [];
      return cache;
    })
    .catch(() => [] as Country[])
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function primeCountries(list: Country[]) {
  cache = list;
}

export function findCountry(list: Country[], code: string): Country | undefined {
  const c = code.toLowerCase();
  return list.find((x) => x.code.toLowerCase() === c);
}

export function indexOfCountry(list: Country[], code: string): number {
  const c = code.toLowerCase();
  return list.findIndex((x) => x.code.toLowerCase() === c);
}

/** region → count, sorted by region name */
export function regionCounts(list: Country[]): { region: string; count: number }[] {
  const m = new Map<string, number>();
  for (const c of list) {
    const r = c.meta?.continent || 'Other';
    m.set(r, (m.get(r) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => a.region.localeCompare(b.region));
}

/** case-insensitive match over name / code / official name */
export function matchesQuery(c: Country, nq: string): boolean {
  if (!nq) return true;
  return (
    c.name.toLowerCase().includes(nq) ||
    c.code.toLowerCase().includes(nq) ||
    (c.meta?.official_name ?? '').toLowerCase().includes(nq)
  );
}

export type HitSegment = { text: string; hit: boolean };

/** split a label into hit / non-hit segments for green highlight */
export function highlightSegments(label: string, nq: string): HitSegment[] {
  if (!nq) return [{ text: label, hit: false }];
  const lower = label.toLowerCase();
  const out: HitSegment[] = [];
  let i = 0;
  for (;;) {
    const j = lower.indexOf(nq, i);
    if (j === -1) {
      out.push({ text: label.slice(i), hit: false });
      break;
    }
    if (j > i) out.push({ text: label.slice(i, j), hit: false });
    out.push({ text: label.slice(j, j + nq.length), hit: true });
    i = j + nq.length;
  }
  return out.filter((s) => s.text.length > 0);
}
