import type { Metadata, Viewport } from 'next';
import dynamic from 'next/dynamic';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { SiteNav } from '../components/nav';
import { TabBar } from '../components/tab-bar';
import { ToastProvider } from '../components/toast';
import { Footer } from '../components/footer';
import { FooterVisibility } from '../components/footer-visibility';
import './globals.css';

/** command palette (cmdk) loads on demand — keeps first-load JS lean */
const CommandPalette = dynamic(() => import('../components/command-palette').then((m) => m.CommandPalette), {
  ssr: false,
});

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: {
    default: 'Flags API — Country Flags & Metadata Platform',
    template: '%s · Flags API',
  },
  description:
    'Fast, free API for 254 country flags (SVG, WebP, PNG, JPG, PDF, AI, EPS) and metadata. One Go binary, zero-copy delivery, immutable caching.',
  keywords: [
    'flags api', 'country flags', 'flag cdn', 'country metadata',
    'iso codes', 'svg flags', 'flag image api', 'country data api',
    'rest api flags', 'download country flags', 'world flags api',
  ],
  robots: { index: true, follow: true },
  authors: [{ name: 'Al A Min', url: 'https://github.com/alaminnna' }],
  creator: 'Al A Min',
  publisher: 'Flags API',
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://country-flags-api.vercel.app',
    siteName: 'Flags API',
    title: 'Flags API — Country Flags & Metadata Platform',
    description:
      'Fast, free API for 254 country flags in SVG, WebP, PNG, JPG, PDF, AI and EPS. One Go binary, zero-copy delivery, immutable caching.',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Flags API — Country flags and metadata for 254 countries',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Flags API — Country Flags & Metadata Platform',
    description:
      'Fast, free API for 254 country flags in SVG, WebP, PNG, JPG, PDF, AI and EPS.',
    images: ['/og.png'],
  },
  alternates: {
    canonical: 'https://country-flags-api.vercel.app',
    types: {
      'application/rss+xml': [
        { title: 'Flags API', url: '/feed.xml' },
      ],
    },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F7FAF8' },
    { media: '(prefers-color-scheme: dark)', color: '#060D0A' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebAPI',
    name: 'Flags API',
    url: 'https://country-flags-api.vercel.app',
    description:
      'Fast, free API for 254 country flags in SVG, WebP, PNG, JPG, PDF, AI and EPS. One Go binary, zero-copy delivery, immutable caching.',
    provider: {
      '@type': 'Organization',
      name: 'Flags API',
      url: 'https://country-flags-api.vercel.app',
    },
    documentation: 'https://country-flags-api.vercel.app/docs',
  };

  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${mono.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <ToastProvider>
            <a href="#main" className="skip-link">
              Skip to content
            </a>
            <div className="grain" aria-hidden />
            <SiteNav />
            <CommandPalette />
            <main id="main">{children}</main>
            <FooterVisibility>
              <Footer />
            </FooterVisibility>
            <TabBar />
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
