'use client';

/**
 * SourceLink — client wrapper for outbound source links on the article page.
 * Fires source_link_clicked with slug and the source domain on click.
 * Isolated as a client sub-component so the parent ArticlePage stays server.
 */
import { SOURCE_LINK_CLICKED, track } from '@/lib/analytics';

import styles from './page.module.scss';

type SourceLinkProps = {
  url: string;
  slug: string;
};

export function SourceLink({ url, slug }: SourceLinkProps) {
  let domain: string;
  try {
    domain = new URL(url).hostname;
  } catch {
    domain = url;
  }

  return (
    <a
      href={url}
      className={styles['source-link']}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track(SOURCE_LINK_CLICKED, { slug, domain })}
    >
      {url}
    </a>
  );
}
