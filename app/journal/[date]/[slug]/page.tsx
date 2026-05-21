import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getArticle } from '@/lib/db';
import { formatDay } from '@/lib/format';
import { parseMarkdown } from '@/lib/markdown';

import styles from './page.module.scss';

type Props = { params: Promise<{ date: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date, slug } = await params;
  // FUTURE(maintainer, 2026-07-01): wrap in 'use cache' once dynamicIO is stable.
  const article = await getArticle(date, slug);
  if (!article) return {};
  return {
    title: `${article.title} — wwwatch`,
    description: article.summary,
  };
}

export default async function ArticlePage({ params }: Props) {
  const { date, slug } = await params;
  const article = await getArticle(date, slug);

  if (!article) notFound();

  const bodyHtml = parseMarkdown(article.body_md);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Link href={`/journal/${date}`} className={styles.back}>
          ← {formatDay(date)}
        </Link>

        <div className={styles.meta}>
          <p className={styles.date}>{formatDay(date)}</p>
          <p className={styles.category}>{article.category}</p>
          <h1 className={styles.title}>{article.title}</h1>
          <p className={styles.summary}>{article.summary}</p>
        </div>

        {/* bodyHtml is sanitized by lib/markdown.ts — safe for dangerouslySetInnerHTML.
            `prose` is a global class from globals.scss that styles rendered markdown. */}
        <div
          className={`${styles.body} prose`}
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />

        {article.sources.length > 0 && (
          <div className={styles.sources}>
            <p className={styles['sources-label']}>Sources</p>
            <ul className={styles['sources-list']}>
              {article.sources.map((s, i) => (
                <li key={i}>
                  <a
                    href={s.url}
                    className={styles['source-link']}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {s.url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
