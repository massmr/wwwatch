import type { Metadata } from 'next';

import { jsonLdString, personSchema } from '@/lib/jsonld';

import styles from './page.module.scss';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wwwatch.dev';

export const metadata: Metadata = {
  title: 'wwwatch — wwwatch',
  description:
    'wwwatch is the editor of wwwatch, a daily AI journal for builders. He reads every draft and publishes each edition.',
  alternates: { canonical: `${SITE_URL}/author/wwwatch` },
  openGraph: {
    title: 'wwwatch — wwwatch',
    description:
      'wwwatch is the editor of wwwatch, a daily AI journal for builders.',
    url: `${SITE_URL}/author/wwwatch`,
  },
};

export default function AuthorPage() {
  return (
    <div className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(personSchema()) }} />

      <div className={styles.container}>
        {/* TODO(maintainer): replace placeholder with real photo (1200px+, square,
            neutral bg) deposited in public/ — see PLAN_7 §8. */}
        <div className={styles.avatar} aria-hidden="true">M</div>

        <h1 className={styles.name}>wwwatch</h1>
        <p className={styles.role}>Editor, wwwatch</p>

        <div className={styles.bio}>
          <p>
            wwwatch edits wwwatch — a daily AI journal for builders. He reads every
            article draft, checks sources, and publishes each edition. The pipeline writes;
            the human decides what ships.
          </p>
          <p>
            wwwatch exists because staying current in AI used to mean two hours a day across a
            dozen feeds. The pipeline automated the watch. The human kept the judgment.
          </p>
        </div>
      </div>
    </div>
  );
}
