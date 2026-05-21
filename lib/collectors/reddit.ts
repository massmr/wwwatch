import { normalizeFingerprint, type RawItem } from './types';

const MIN_SCORE = 50;
const TIMEOUT_MS = 10_000;

// Subreddits with strong AI/LLM signal. Score filter eliminates noise.
const SUBREDDITS = [
  'LocalLLaMA',
  'ClaudeAI',
  'MachineLearning',
  'LangChain',
  'ChatGPT',
];

type RedditPost = {
  data: {
    id: string;
    name: string;       // e.g. 't3_abc123'
    title: string;
    url: string;
    score: number;
    num_comments: number;
    created_utc: number; // Unix timestamp
    selftext: string;
    is_self: boolean;
    permalink: string;
    subreddit: string;
  };
};

type RedditListing = {
  data: {
    children: RedditPost[];
  };
};

function isRedditListing(data: unknown): data is RedditListing {
  if (typeof data !== 'object' || data === null) return false;
  const outer = (data as Record<string, unknown>)['data'];
  if (typeof outer !== 'object' || outer === null) return false;
  return Array.isArray((outer as Record<string, unknown>)['children']);
}

/**
 * Collects hot posts from AI-focused subreddits.
 * Link posts use their external URL; self-posts use the Reddit permalink.
 * Filters: score >= 50.
 */
export async function collectReddit(): Promise<RawItem[]> {
  const items: RawItem[] = [];

  for (const subreddit of SUBREDDITS) {
    const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=25`;

    let data: unknown;
    try {
      const res = await fetch(url, {
        headers: {
          // Reddit blocks requests without a descriptive User-Agent.
          'User-Agent': 'wwwatch/1.0 (daily pipeline; contact: https://wwwatch.dev)',
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        console.error(`[collectors] reddit r/${subreddit} → HTTP ${res.status}`);
        continue;
      }
      data = await res.json();
    } catch (err) {
      console.error(`[collectors] reddit r/${subreddit} fetch error:`, err);
      continue;
    }

    if (!isRedditListing(data)) {
      console.error(`[collectors] reddit r/${subreddit} unexpected response shape`);
      continue;
    }

    for (const child of data.data.children) {
      // Some stickied/admin posts can have an unexpected shape.
      if (!child.data) continue;
      const post = child.data;
      if (post.score < MIN_SCORE) continue;

      // Self-posts are discussions — no external URL to fetch, cannot be enriched.
      // Only link posts (which point to an external article, paper, or announcement)
      // are useful for the pipeline.
      if (post.is_self) continue;

      items.push({
        id: `reddit_${post.id}`,
        source: `reddit_${subreddit.toLowerCase()}`,
        title: post.title,
        url: post.url,
        description: null,
        published_at: new Date(post.created_utc * 1000).toISOString(),
        upvotes: post.score,
        comments: post.num_comments,
        score: null,
        fingerprint: normalizeFingerprint(post.title),
      });
    }
  }

  return items;
}
