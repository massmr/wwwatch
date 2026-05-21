import { normalizeFingerprint, type RawItem } from './types';

const GITHUB_API = 'https://api.github.com';
const MIN_STARS = 100;
const TIMEOUT_MS = 10_000;

// Topic-based searches that signal agentic AI repos.
const TOPICS = ['llm', 'ai-agent', 'large-language-model'];

type GhRepo = {
  id: number;
  full_name: string;
  name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  pushed_at: string;
  topics: string[];
};

type GhSearchResponse = {
  items: GhRepo[];
};

function isGhSearchResponse(data: unknown): data is GhSearchResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'items' in data &&
    Array.isArray((data as Record<string, unknown>)['items'])
  );
}

/**
 * Collects recently-active AI repos from GitHub.
 *
 * GitHub has no public "trending" API — this uses the Search API to find
 * repos updated in the last 2 days with agentic AI topics, sorted by stars.
 * `stars` is the total stargazers count (GitHub does not expose daily stars
 * via the public API).
 */
export async function collectGithub(): Promise<RawItem[]> {
  // 2 days back to catch late night pushes in different time zones.
  const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const seen = new Set<string>();
  const items: RawItem[] = [];

  for (const topic of TOPICS) {
    const url =
      `${GITHUB_API}/search/repositories` +
      `?q=topic:${topic}+pushed:>=${since}` +
      `&sort=stars&order=desc&per_page=20`;

    let data: unknown;
    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'wwwatch/1.0 (daily pipeline)',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        console.error(`[collectors] github topic:${topic} → HTTP ${res.status}`);
        continue;
      }
      data = await res.json();
    } catch (err) {
      console.error(`[collectors] github topic:${topic} fetch error:`, err);
      continue;
    }

    if (!isGhSearchResponse(data)) {
      console.error(`[collectors] github topic:${topic} unexpected response shape`);
      continue;
    }

    for (const repo of data.items) {
      if (repo.stargazers_count < MIN_STARS) continue;
      const key = repo.full_name;
      if (seen.has(key)) continue;
      seen.add(key);

      const title = repo.description
        ? `${repo.full_name}: ${repo.description}`
        : repo.full_name;

      items.push({
        id: `gh_${repo.full_name.replace('/', '_').toLowerCase()}`,
        source: 'github',
        title,
        url: repo.html_url,
        description: repo.description,
        published_at: repo.pushed_at,
        stars: repo.stargazers_count,
        score: null,
        fingerprint: normalizeFingerprint(title),
      });
    }
  }

  return items;
}
