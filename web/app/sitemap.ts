import fs from 'fs';
import path from 'path';
import type { MetadataRoute } from 'next';

type BaseEntry = { code: string; name: string };

function readBase(): BaseEntry[] {
  const candidates = [
    path.join(process.cwd(), '..', 'assets', 'countries-base.json'),
    path.join(process.cwd(), 'assets', 'countries-base.json'),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8')) as BaseEntry[];
    }
  }
  return [];
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = readBase();
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: 'https://country-flags-api.vercel.app', lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: 'https://country-flags-api.vercel.app/explore', lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: 'https://country-flags-api.vercel.app/quiz', lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: 'https://country-flags-api.vercel.app/playground', lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://country-flags-api.vercel.app/docs', lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://country-flags-api.vercel.app/compare', lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: 'https://country-flags-api.vercel.app/about', lastModified: now, changeFrequency: 'yearly', priority: 0.5 },
  ];

  const countryPages: MetadataRoute.Sitemap = base.map((c) => ({
    url: `https://country-flags-api.vercel.app/country/${c.code}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [...staticPages, ...countryPages];
}
