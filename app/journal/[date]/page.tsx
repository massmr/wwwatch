import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getEdition } from '@/lib/db';
import { formatDay } from '@/lib/format';

import { ArticleCard } from './ArticleCard';
import styles from './page.module.scss';

type Props = { params: Promise<{ date: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date } = await params;
  return {
    title: `${formatDay(date)} — wwwatch`,
    description: `Today's AI journal edition for ${formatDay(date)}.`,
  };
}

export default async function EditionPage({ params }: Props) {
  const { date } = await params;
  const edition = await getEdition(date);

  if (!edition) notFound();

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Link href="/journal" className={styles.back}>← Journal</Link>

        <p className={styles.date}>{formatDay(date)}</p>

        {edition.status === 'draft' && (
          <div className={styles['draft-banner']}>
            Draft — not yet published. Run <code>npm run publish -- {date}</code> when ready.
          </div>
        )}

        {edition.intro_md && (
          <p className={styles.intro}>{edition.intro_md}</p>
        )}

        <div className={styles.articles}>
          {edition.articles.map((a, i) => (
            <ArticleCard
              key={a.slug}
              date={date}
              slug={a.slug}
              category={a.category}
              title={a.title}
              summary={a.summary}
              position={i}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
