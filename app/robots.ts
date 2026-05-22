/**
 * app/robots.ts — robots.txt generation.
 * Allow all crawlers, block /api/, list both sitemaps.
 */
import type { MetadataRoute } from 'next';

import { SITE_URL } from '@/lib/site-url';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/api/',
    },
    sitemap: [`${SITE_URL}/sitemap.xml`, `${SITE_URL}/news-sitemap.xml`],
  };
}
