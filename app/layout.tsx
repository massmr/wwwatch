import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';

import { jsonLdString, newsMediaOrgSchema, websiteSchema } from '@/lib/jsonld';
import { SITE_URL } from '@/lib/site-url';

import './_styles/globals.scss';
import styles from './layout.module.scss';
import { PostHogPageView } from './PostHogPageView';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'wwwatch — AI intel for builders',
    template: '%s',
  },
  description:
    'A daily journal of what actually moved in AI. The models, tools, and releases that change what you build this week. Five minutes. Sourced. No hype.',
  openGraph: {
    siteName: 'wwwatch',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
  },
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
  robots: {
    index: true,
    follow: true,
    'max-image-preview': 'large',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Site-wide structured data */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(websiteSchema()) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(newsMediaOrgSchema()) }} />

        {/* PostHogPageView is client-only and suspends during SSR — Suspense required. */}
        <Suspense>
          <PostHogPageView />
        </Suspense>

        <header className={styles.header}>
          <div className={styles['header-inner']}>
            <Link href="/" className={styles.logo}>
              <Image
                src="/logo.png"
                alt="wwwatch"
                width={120}
                height={60}
                priority
                className={styles['logo-img']}
              />
            </Link>
            <nav className={styles.nav}>
              <Link href="/today" className={styles['nav-link']}>Today</Link>
              <Link href="/journal" className={styles['nav-link']}>Journal</Link>
              <Link href="/#subscribe" className={styles['nav-link']}>Subscribe</Link>
              <Link href="/about" className={styles['nav-link']}>About</Link>
            </nav>
          </div>
        </header>

        {children}

        <footer className={styles.footer}>
          <div className={styles['footer-inner']}>
            <div className={styles['footer-nav']}>
              <Link href="/today" className={styles['footer-link']}>Today</Link>
              <Link href="/journal" className={styles['footer-link']}>Journal</Link>
              <Link href="/about" className={styles['footer-link']}>About</Link>
              <Link href="/author/wwwatch" className={styles['footer-link']}>wwwatch</Link>
            </div>
            <p className={styles['footer-copy']}>
              Built by builders, for builders. No ads, no clickbait, no sponsored picks in the feed.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
