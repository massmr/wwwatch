'use client';

/**
 * ArticleCard — client wrapper around the article link on the edition page.
 * Fires article_link_clicked on click with slug, category and position.
 * Isolated as a client sub-component so the parent EditionPage stays server.
 */
import Link from 'next/link';

import { ARTICLE_LINK_CLICKED, track } from '@/lib/analytics';

import styles from './page.module.scss';

type ArticleCardProps = {
  date: string;
  slug: string;
  category: string;
  title: string;
  summary: string;
  position: number;
};

export function ArticleCard({ date, slug, category, title, summary, position }: ArticleCardProps) {
  return (
    <Link
      href={`/journal/${date}/${slug}`}
      className={styles['article-card']}
      onClick={() => track(ARTICLE_LINK_CLICKED, { slug, category, position })}
    >
      <span className={styles['article-cat']}>{category}</span>
      <div className={styles['article-content']}>
        <div className={styles['article-title']}>{title}</div>
        <p className={styles['article-summary']}>{summary}</p>
      </div>
    </Link>
  );
}
