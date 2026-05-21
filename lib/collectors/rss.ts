import Parser from 'rss-parser';

import { normalizeFingerprint, type RawItem } from './types';

const TIMEOUT_MS = 15_000;

/**
 * RSS feeds for Role 2 — primary sources (official blogs/changelogs).
 * These are high-authority, low-noise feeds. No score filter needed.
 *
 * NOTE: URLs that 404 are silently caught and logged — one dead feed
 * never kills the run (see CONVENTIONS §Pipeline règle 6).
 */
const FEEDS: Array<{ source: string; url: string }> = [
  // AI labs (confirmed working)
  { source: 'rss_openai', url: 'https://openai.com/blog/rss.xml' },
  // Developer tools (confirmed working)
  { source: 'rss_github', url: 'https://github.blog/feed/' },
  { source: 'rss_vercel', url: 'https://vercel.com/blog/rss.xml' },
  // Microsoft AI blog (agentic enterprise signal)
  { source: 'rss_microsoft_ai', url: 'https://blogs.microsoft.com/ai/feed/' },
  // TODO(maintainer, 2026-06-15): find working RSS URLs for the following:
  //   Anthropic  — no public RSS found (check https://www.anthropic.com/news)
  //   Google DeepMind — https://deepmind.google/blog/rss/ returns 404
  //   Meta AI    — https://ai.meta.com/blog/rss/ returns 404
  //   LangChain  — https://blog.langchain.dev/rss/ has malformed XML entities
];

// rss-parser uses a socket idle-timeout internally, not a total deadline —
// a slow-but-active feed can exceed TIMEOUT_MS. Acceptable for a cron job.
const parser = new Parser({ timeout: TIMEOUT_MS });

/**
 * Collects items from all configured RSS feeds.
 * Limits to 10 items per feed (most recent only).
 */
export async function collectRss(): Promise<RawItem[]> {
  const items: RawItem[] = [];

  for (const feed of FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);

      const recent = (parsed.items ?? []).slice(0, 10);

      for (const item of recent) {
        const title = item.title?.trim();
        const url = item.link?.trim();

        if (!title || !url) continue;

        const publishedAt =
          item.isoDate ?? (item.pubDate ? new Date(item.pubDate).toISOString() : null);

        if (!publishedAt) continue;

        // Stable ID: use guid if available, else the URL itself.
        const rawId = item.guid ?? url;
        // Sanitise to a safe DB key.
        const idSuffix = rawId.replace(/[^a-z0-9]/gi, '_').slice(-40);

        items.push({
          id: `${feed.source}_${idSuffix}`,
          source: feed.source,
          title,
          url,
          description: item.contentSnippet?.slice(0, 400) ?? null,
          published_at: publishedAt,
          score: null,
          fingerprint: normalizeFingerprint(title),
        });
      }
    } catch (err) {
      // Per CONVENTIONS §Pipeline règle 6: log and continue, never throw.
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[collectors] ${feed.source} failed: ${msg}`);
    }
  }

  return items;
}
