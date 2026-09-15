import fs from 'fs';
import path from 'path';
import type { Metadata } from 'next';
import CountryClient from './client';

export const dynamicParams = false;

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
  return [{ code: 'bd', name: 'Bangladesh' }];
}

export async function generateStaticParams() {
  // 254 country pages pre-rendered at build time.
  return readBase().map((c) => ({ code: c.code }));
}

export async function generateMetadata({ params }: { params: { code: string } }): Promise<Metadata> {
  const entry = readBase().find((c) => c.code === params.code);
  const name = entry?.name ?? params.code.toUpperCase();
  const code = params.code.toUpperCase();
  return {
    title: `${name} — Flag, Assets & Metadata`,
    description: `Download the flag of ${name} in SVG, WebP, PNG, JPG, PDF, AI and EPS. Metadata, asset matrix and API usage for ${code}.`,
    keywords: [`${name} flag`, `${name} country`, `${code} flag`, `${name} metadata`, `${code} iso`],
    openGraph: {
      title: `${name} — Flag, Assets & Metadata | Flags API`,
      description: `Download the flag of ${name} in SVG, WebP, PNG, JPG, PDF, AI and EPS. Metadata, asset matrix and API usage for ${code}.`,
      url: `https://country-flags-api.vercel.app/country/${params.code}`,
      images: [
        {
          url: `/assets/v1/icons/640x480/${params.code}.png`,
          width: 640,
          height: 480,
          alt: `Flag of ${name}`,
        },
      ],
    },
    twitter: {
      title: `${name} — Flag, Assets & Metadata | Flags API`,
      description: `Download the flag of ${name} in SVG, WebP, PNG, JPG, PDF, AI and EPS.`,
      images: [`/assets/v1/icons/640x480/${params.code}.png`],
    },
    alternates: {
      canonical: `https://country-flags-api.vercel.app/country/${params.code}`,
    },
  };
}

export default function CountryPage({ params }: { params: { code: string } }) {
  return <CountryClient code={params.code} />;
}
