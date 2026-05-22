/**
 * GET /news-sitemap.xml — Google News sitemap.
 * Contains only articles published in the last 48 hours — Google News requires
 * items to be removed beyond that window. Revalidates every hour.
 *
 * Uses a Route Handler rather than app/sitemap.ts because the native sitemap
 * convention does not support the <news:news> XML extension.
 */
import { getRecentPublishedArticles } from '@/lib/db';
import { SITE_URL } from '@/lib/site-url';


// Revalidate every hour so fresh articles appear promptly.
export const revalidate = 3600;

export async function GET(): Promise<Response> {
  const articles = await getRecentPublishedArticles(48);

  const items = articles
    .map((a) => {
      const url = `${SITE_URL}/journal/${a.day}/${a.slug}`;
      const pubDate = `${a.day}T00:00:00+00:00`;
      const title = a.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      return `  <url>
    <loc>${url}</loc>
    <news:news>
      <news:publication>
        <news:name>wwwatch</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${pubDate}</news:publication_date>
      <news:title>${title}</news:title>
    </news:news>
    <lastmod>${pubDate}</lastmod>
  </url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${items}
</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
