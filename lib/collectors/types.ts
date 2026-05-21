/**
 * Raw item as collected from a source before scoring or enrichment.
 * `score` is null until lib/scoring.ts runs in Phase 3.
 */
export type RawItem = {
  /** Stable unique ID, e.g. 'hn_12345', 'gh_vercel_ai', 'hf_2401.00001', 'reddit_abc'. */
  id: string;
  /** Source slug, e.g. 'hacker_news', 'github', 'hugging_face', 'reddit', 'rss_anthropic'. */
  source: string;
  title: string;
  url: string;
  description?: string | null;
  /** ISO 8601 string. */
  published_at: string;
  upvotes?: number | null;
  stars?: number | null;
  comments?: number | null;
  /** Filled by lib/scoring.ts in Phase 3; null until then. */
  score?: number | null;
  /** Normalised title for intra-run and cross-day dedup. See normalizeFingerprint. */
  fingerprint: string;
  /**
   * The aggregator permalink where the story was discovered (e.g. Reddit thread URL).
   * Set by collectors that have a separate outbound URL and a discovery page.
   * Used as a secondary source citation; never the primary fetch target.
   */
  discovery_url?: string;
};

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'its', 'it', 'this', 'that', 'as', 'up',
  'how', 'why', 'what', 'new', 'using', 'use', 'get', 'now', 'just',
  'also', 'can', 'i', 'we', 'you', 'your', 'my', 'our',
]);

/**
 * Normalises a title into a dedup fingerprint.
 * Lowercase, strip punctuation, remove stop-words and single chars.
 * Used for intra-run dedup (same story via HN + Reddit + blog)
 * and inter-day dedup (don't rewrite the same story tomorrow).
 */
export function normalizeFingerprint(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .join(' ')
    .trim();
}
