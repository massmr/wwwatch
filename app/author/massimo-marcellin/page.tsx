import type { Metadata } from 'next';
import Image from 'next/image';

import { jsonLdString, personSchema } from '@/lib/jsonld';
import { SITE_URL } from '@/lib/site-url';

import styles from './page.module.scss';

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
    images: [{ url: `${SITE_URL}/massimo.png`, width: 500, height: 500 }],
  },
};

export default function AuthorPage() {
  return (
    <div className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(personSchema()) }} />

      <div className={styles.container}>
        <Image
          src="/massimo.png"
          alt="wwwatch"
          width={96}
          height={96}
          className={styles.avatar}
          priority
        />

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
