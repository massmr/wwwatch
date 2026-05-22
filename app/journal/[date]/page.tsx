import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getEdition } from '@/lib/db';
import { formatDay } from '@/lib/format';
import { breadcrumbSchema, jsonLdString } from '@/lib/jsonld';
import { SITE_URL } from '@/lib/site-url';

import { ArticleCard } from './ArticleCard';
import styles from './page.module.scss';

type Props = { params: Promise<{ date: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date } = await params;
  const edition = await getEdition(date);
  if (!edition) return {};

  const canonical = `${SITE_URL}/journal/${date}`;
  // Strip basic markdown syntax before using as meta description (plain text only).
  const plainIntro = edition.intro_md
    ? edition.intro_md.replace(/[*_#>`[\]]/g, '').replace(/\s+/g, ' ').trim()
    : null;
  const description = plainIntro
    ? plainIntro.slice(0, 160)
    : `wwwatch AI journal for ${formatDay(date)} — ${edition.article_count} articles.`;

  return {
    title: `${formatDay(date)} — wwwatch`,
    description,
    alternates: { canonical },
    robots: { 'max-image-preview': 'large' },
    openGraph: {
      title: `${formatDay(date)} — wwwatch`,
      description,
      type: 'website',
      url: canonical,
      images: [{ url: `${canonical}/opengraph-image`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${formatDay(date)} — wwwatch`,
      description,
    },
  };
}

export default async function EditionPage({ params }: Props) {
  const { date } = await params;
  const edition = await getEdition(date);

  if (!edition) notFound();

  const canonical = `${SITE_URL}/journal/${date}`;

  const breadcrumbLd = breadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: 'Journal', url: `${SITE_URL}/journal` },
    { name: formatDay(date), url: canonical },
  ]);

  return (
    <div className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbLd) }} />

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
