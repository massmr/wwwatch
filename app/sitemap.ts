/**
 * app/sitemap.ts — Main XML sitemap.
 * Covers static pages, all published editions, and all published articles.
 * priority/changefreq omitted — Google ignores them.
 */
import type { MetadataRoute } from 'next';

import { listPublishedArticleStubs, listPublishedEditions } from '@/lib/db';
import { SITE_URL } from '@/lib/site-url';

// Revalidate every hour so new editions appear without a full redeploy.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [editions, articles] = await Promise.all([
    listPublishedEditions(),
    listPublishedArticleStubs(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: editions[0]?.created_at ? new Date(editions[0].created_at) : new Date() },
    { url: `${SITE_URL}/about` },
    { url: `${SITE_URL}/journal`, lastModified: editions[0]?.created_at ? new Date(editions[0].created_at) : new Date() },
  ];

  const editionRoutes: MetadataRoute.Sitemap = editions.map((e) => ({
    url: `${SITE_URL}/journal/${e.day}`,
    lastModified: new Date(e.created_at),
  }));

  const articleRoutes: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${SITE_URL}/journal/${a.day}/${a.slug}`,
    lastModified: new Date(a.created_at),
  }));

  return [...staticRoutes, ...editionRoutes, ...articleRoutes];
}
