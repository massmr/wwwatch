import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getArticle } from '@/lib/db';
import { formatDay } from '@/lib/format';
import { breadcrumbSchema, jsonLdString, newsArticleSchema } from '@/lib/jsonld';
import { parseMarkdown } from '@/lib/markdown';

import { SourceLink } from './SourceLink';
import styles from './page.module.scss';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wwwatch.dev';

type Props = { params: Promise<{ date: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date, slug } = await params;
  const article = await getArticle(date, slug);
  if (!article) return {};

  const canonical = `${SITE_URL}/journal/${date}/${slug}`;
  const ogImageUrl = `${canonical}/opengraph-image`;

  return {
    title: `${article.title} — wwwatch`,
    description: article.summary,
    authors: [{ name: 'wwwatch', url: `${SITE_URL}/author/wwwatch` }],
    alternates: { canonical },
    robots: { 'max-image-preview': 'large' },
    openGraph: {
      title: article.title,
      description: article.summary,
      type: 'article',
      url: canonical,
      publishedTime: `${article.day}T00:00:00+00:00`,
      authors: ['wwwatch'],
      section: article.category,
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.summary,
      images: [ogImageUrl],
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { date, slug } = await params;
  const article = await getArticle(date, slug);

  if (!article) notFound();

  const bodyHtml = parseMarkdown(article.body_md);

  const canonical = `${SITE_URL}/journal/${date}/${slug}`;
  const ogImageUrl = `${canonical}/opengraph-image`;

  const articleLd = newsArticleSchema({
    headline: article.title,
    description: article.summary,
    url: canonical,
    ogImageUrl,
    datePublished: article.day,
    category: article.category,
  });

  const breadcrumbLd = breadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: 'Journal', url: `${SITE_URL}/journal` },
    { name: formatDay(date), url: `${SITE_URL}/journal/${date}` },
    { name: article.title, url: canonical },
  ]);

  return (
    <div className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(articleLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbLd) }} />

      <div className={styles.container}>
        <Link href={`/journal/${date}`} className={styles.back}>
          {'\u2190'} {formatDay(date)}
        </Link>

        <div className={styles.meta}>
          <p className={styles.date}>{formatDay(date)}</p>
          <p className={styles.category}>{article.category}</p>
          <h1 className={styles.title}>{article.title}</h1>
          <p className={styles.summary}>{article.summary}</p>
          <p className={styles.byline}>
            By{' '}
            <Link href="/author/wwwatch" className={styles['byline-link']}>
              wwwatch
            </Link>
          </p>
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
                  <SourceLink url={s.url} slug={slug} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
