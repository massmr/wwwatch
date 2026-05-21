// Archive list changes on each new edition — opt out of static pre-rendering.
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';

import { listPublishedEditions } from '@/lib/db';
import { formatDay } from '@/lib/format';

import styles from './page.module.scss';

export const metadata: Metadata = {
  title: 'Journal — wwwatch',
  description: 'All editions of the wwwatch daily AI journal.',
};

export default async function JournalPage() {
  const editions = await listPublishedEditions();

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>Journal</h1>

        {editions.length === 0 ? (
          <p className={styles.empty}>No editions published yet. Check back soon.</p>
        ) : (
          <ul className={styles.list}>
            {editions.map((e) => (
              <li key={e.day} className={styles.item}>
                <Link href={`/journal/${e.day}`} className={styles.link}>
                  <span className={styles.date}>{formatDay(e.day)}</span>
                  <span className={styles.count}>{e.article_count} articles</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
