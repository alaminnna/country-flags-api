import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/quiz/play', '/quiz/duel'],
      },
    ],
    sitemap: 'https://country-flags-api.vercel.app/sitemap.xml',
  };
}
