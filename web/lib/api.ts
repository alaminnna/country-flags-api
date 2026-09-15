export type Neighbor = { name: string; code: string; flag: string };

export type Country = {
  code: string;
  name: string;
  meta: {
    title: string;
    note: string;
    description: string;
    emoji: string;
    emoji_label: string;
    sovereign_state: string;
    country_codes: string;
    official_name: string;
    capital: string;
    continent: string;
    member_of: string[];
    population: string;
    area: string;
    highest_point: string;
    lowest_point: string;
    gdp_per_capita: string;
    currency: string;
    calling_code: string;
    tld: string;
    neighbors: Neighbor[];
    location: { map_code: string };
  };
  flags: Record<string, string>;
};

export type AssetEntry = {
  type: 'image' | 'icon' | 'vector';
  format: string;
  size: string;
  url: string;
  bytes: number;
  width?: number;
  height?: number;
};

/** Canonical immutable flag URL for <img> use. */
export function flagUrl(code: string, opts?: { size?: string; format?: string; type?: 'image' | 'icon' | 'vector' }): string {
  const type = opts?.type ?? 'image';
  const format = opts?.format ?? 'png';
  const size = opts?.size ?? (type === 'icon' ? '80x60' : 'w320');
  const base = apiBase();
  if (type === 'vector') return `${base}/assets/v1/vectors/${format}/${code}.${format}`;
  if (type === 'icon') return `${base}/assets/v1/icons/${size}/${code}.${format}`;
  // image: w-sizes use w<N> dirs, h-sizes use h<N> dirs
  if (/^\d+$/.test(size)) {
    // default width dir
    return `${base}/assets/v1/images/w${size}/${code}.${format}`;
  }
  if (/^\d+x\d+$/.test(size)) return `${base}/assets/v1/images/w${size.split('x')[0]}/${code}.${format}`;
  return `${base}/assets/v1/images/${size}/${code}.${format}`;
}

export function fmtBytes(n: number): string {
  if (!n && n !== 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? '';
}

export async function fetchJSON<T>(url: string): Promise<T> {
  const r = await fetch(`${apiBase()}${url}`);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json() as Promise<T>;
}
