import { normalizeFingerprint, type RawItem } from './types';

const ALGOLIA_URL = 'https://hn.algolia.com/api/v1';
const MIN_POINTS = 50;
const TIMEOUT_MS = 10_000;

// Keywords with strong agentic AI signal — broader terms first.
const KEYWORDS = ['ai agent', 'llm', 'claude', 'openai', 'anthropic', 'langchain'];

type HnHit = {
  objectID: string;
  title: string;
  url: string | null;
  points: number;
  num_comments: number;
  created_at: string;
};

type HnResponse = {
  hits: HnHit[];
};

function isHnResponse(data: unknown): data is HnResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'hits' in data &&
    Array.isArray((data as Record<string, unknown>)['hits'])
  );
}

/**
 * Collects top AI/agent stories from Hacker News via the Algolia search API.
 * Filters to stories with >= 50 points published in the last 24 hours.
 */
export async function collectHackerNews(): Promise<RawItem[]> {
  const seen = new Set<string>();
  const items: RawItem[] = [];
  // Yesterday's Unix timestamp for recency filter.
  const since = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);

  for (const keyword of KEYWORDS) {
    const url =
      `${ALGOLIA_URL}/search?query=${encodeURIComponent(keyword)}` +
      `&tags=story&hitsPerPage=30` +
      `&numericFilters=points>${MIN_POINTS},created_at_i>${since}`;

    let data: unknown;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'wwwatch/1.0 (daily pipeline)' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        console.error(`[collectors] hacker_news "${keyword}" → HTTP ${res.status}`);
        continue;
      }
      data = await res.json();
    } catch (err) {
      console.error(`[collectors] hacker_news "${keyword}" fetch error:`, err);
      continue;
    }

    if (!isHnResponse(data)) {
      console.error(`[collectors] hacker_news "${keyword}" unexpected response shape`);
      continue;
    }

    for (const hit of data.hits) {
      // Skip Ask HN / Show HN that have no external URL.
      if (!hit.url || seen.has(hit.objectID)) continue;
      seen.add(hit.objectID);

      items.push({
        id: `hn_${hit.objectID}`,
        source: 'hacker_news',
        title: hit.title,
        url: hit.url,
        published_at: hit.created_at,
        upvotes: hit.points,
        comments: hit.num_comments,
        score: null,
        fingerprint: normalizeFingerprint(hit.title),
      });
    }
  }

  return items;
}
