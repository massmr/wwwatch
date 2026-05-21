// DB content changes on each publish — opt out of static pre-rendering.
export const dynamic = 'force-dynamic';

import Link from 'next/link';

import { getEdition, getLatestPublishedEdition } from '@/lib/db';
import { formatDay } from '@/lib/format';

import { SubscribeForm } from './SubscribeForm';
import styles from './page.module.scss';

export default async function HomePage() {
  const latestMeta = await getLatestPublishedEdition();
  // getEdition fetches the full edition with articles for the preview list.
  const latest = latestMeta ? await getEdition(latestMeta.day) : null;

  return (
    <div className={styles.page}>

      <section className={styles.hero}>
        <div className={styles.container}>
          <div className={styles.badge}>
            <span className={styles.dot} />
            <span>DAILY JOURNAL · FREE</span>
          </div>

          <h1 className={styles.title}>
            AI intel for <em>product engineers</em>.
          </h1>

          <p className={styles.subtitle}>
            A daily journal of what moved in AI — models, tools, research, funding.
            Curated for builders, not hype-followers.
          </p>

          <div id="subscribe">
            <SubscribeForm />
          </div>
        </div>
      </section>

      {latest ? (
        <section className={styles.preview}>
          <div className={styles.container}>
            <div className={styles['preview-header']}>
              <span className={styles['preview-label']}>Latest edition</span>
              <Link href={`/journal/${latest.day}`} className={styles['preview-date']}>
                {formatDay(latest.day)} →
              </Link>
            </div>

            {latest.intro_md && (
              <p className={styles['preview-intro']}>{latest.intro_md}</p>
            )}

            <div className={styles['preview-articles']}>
              {latest.articles.slice(0, 5).map((a) => (
                <Link
                  key={a.slug}
                  href={`/journal/${latest.day}/${a.slug}`}
                  className={styles['preview-article']}
                >
                  <span className={styles['preview-article-cat']}>{a.category}</span>
                  <span className={styles['preview-article-title']}>{a.title}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <div className={styles['coming-soon']}>
          <div className={styles.container}>
            First edition coming soon.
          </div>
        </div>
      )}

    </div>
  );
}
