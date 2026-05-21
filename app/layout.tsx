import type { Metadata } from 'next';
import Link from 'next/link';

import './_styles/globals.scss';
import styles from './layout.module.scss';

export const metadata: Metadata = {
  title: 'wwwatch — AI intel for product engineers',
  description:
    'A daily journal of what moved in AI — models, tools, research, funding. Curated for builders, not hype-followers.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className={styles.header}>
          <div className={styles['header-inner']}>
            <Link href="/" className={styles.logo}>wwwatch</Link>
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
            wwwatch — daily AI intel for product engineers. No ads.
          </div>
        </footer>
      </body>
    </html>
  );
}
