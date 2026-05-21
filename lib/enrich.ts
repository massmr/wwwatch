import type { ScoredItem } from './scoring';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SourceMaterial = {
  /** Fetched text content — the only material the writer is allowed to use. */
  content: string;
  /** Source URLs from which the content was drawn. Populates articles.sources. */
  urls: string[];
};

/**
 * A scored item enriched with its fetched source material.
 * If `sourceMaterial` is null the item must be dropped — there is no
 * factual basis to write from.
 */
export type EnrichedItem = ScoredItem & {
  sourceMaterial: SourceMaterial;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 15_000;

// Minimum content length to consider a fetch successful.
const MIN_CONTENT_LENGTH = 150;

// RSS primary sources already carry a complete description from the feed.
// No need to re-fetch.
const PRIMARY_RSS_PREFIXES = ['rss_'];

// ─── HTML helpers ─────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractArxivAbstract(html: string): string {
  const match = html.match(
    /<blockquote[^>]*class="[^"]*abstract[^"]*"[^>]*>([\s\S]*?)<\/blockquote>/i,
  );
  if (match?.[1]) {
    return stripHtml(match[1]).replace(/^Abstract:\s*/i, '').trim();
  }
  return '';
}

// ─── Source-specific fetchers ─────────────────────────────────────────────────

async function fetchGitHubMaterial(url: string): Promise<SourceMaterial | null> {
  const match = url.match(/github\.com\/([^/?#]+\/[^/?#]+)/);
  if (!match?.[1]) return null;
  const repo = match[1].replace(/\.git$/, '');

  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'wwwatch/1.0 (daily pipeline)',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  // 1. Try latest release first — most informative for event detection.
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.ok) {
      type Release = { tag_name?: string; name?: string; body?: string; html_url?: string };
      const release = (await res.json()) as Release;
      const parts = [
        release.name ?? release.tag_name,
        release.body?.slice(0, 2500),
      ].filter(Boolean);
      const content = parts.join('\n\n');
      if (content.length >= MIN_CONTENT_LENGTH) {
        return {
          content,
          urls: [release.html_url ?? url, url].filter((v, i, a) => a.indexOf(v) === i),
        };
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[enrich] GitHub releases fetch failed for ${repo}: ${msg}`);
    // fall through to README
  }

  // 2. Fall back to README.
  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/readme`,
      // raw+json returns the plain text / markdown directly.
      { headers: { ...headers, Accept: 'application/vnd.github.raw+json' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    );
    if (res.ok) {
      const text = await res.text();
      const content = text.slice(0, 3000);
      if (content.length >= MIN_CONTENT_LENGTH) {
        return { content, urls: [url] };
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[enrich] GitHub README fetch failed for ${repo}: ${msg}`);
    // fall through to null
  }

  return null;
}

async function fetchArxivAbstract(url: string): Promise<SourceMaterial | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'wwwatch/1.0 (daily pipeline)' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const abstract = extractArxivAbstract(html);
    if (abstract.length < MIN_CONTENT_LENGTH) return null;
    return { content: abstract, urls: [url] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[enrich] arxiv fetch failed for ${url}: ${msg}`);
    return null;
  }
}

async function fetchWebPage(url: string): Promise<SourceMaterial | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'wwwatch/1.0 (daily pipeline)' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const text = stripHtml(html).slice(0, 3000);
    if (text.length < MIN_CONTENT_LENGTH) return null;
    return { content: text, urls: [url] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[enrich] web fetch failed for ${url}: ${msg}`);
    return null;
  }
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

async function fetchSourceMaterial(item: ScoredItem): Promise<SourceMaterial | null> {
  const { url, source, description } = item;

  // Primary RSS: the feed description is already authoritative content.
  if (PRIMARY_RSS_PREFIXES.some((p) => source.startsWith(p))) {
    const content = description?.trim() ?? '';
    if (content.length >= MIN_CONTENT_LENGTH) {
      return { content, urls: [url] };
    }
    // Short description — fetch the full article.
    return fetchWebPage(url);
  }

  // GitHub repos: use the GitHub API for clean structured content.
  if (source === 'github') {
    return fetchGitHubMaterial(url);
  }

  // Hugging Face papers link to arxiv — extract the abstract.
  if (source === 'hugging_face' && url.includes('arxiv.org')) {
    return fetchArxivAbstract(url);
  }

  // Everything else (HN, Reddit, etc.): fetch the linked page.
  return fetchWebPage(url);
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Enriches each scored item by fetching its actual source content.
 *
 * Correction v3.1: the writer MUST write from real fetched content, not
 * from its training memory. This step produces the `source_material` that
 * constrains the writer. Items for which no content can be fetched are
 * dropped — there is nothing factual to write from.
 *
 * Note: web_search is NOT used here. It was removed in v3.1 because:
 * (a) it was the cause of 429 rate-limit errors on the free tier, and
 * (b) the primary quality problem was comblement (fabrication), not lack
 * of search. Fetching the actual source page addresses (b) directly.
 * web_search as a supplement can be re-added once base quality is proven.
 */
export async function enrichItems(items: ScoredItem[]): Promise<EnrichedItem[]> {
  const result: EnrichedItem[] = [];
  let enriched = 0;
  let dropped = 0;

  for (const item of items) {
    const sourceMaterial = await fetchSourceMaterial(item);

    if (!sourceMaterial) {
      console.error(`[enrich] dropped: no source content — "${item.title.slice(0, 70)}"`);
      dropped++;
      continue;
    }

    result.push({ ...item, sourceMaterial });
    enriched++;
    console.log(
      `[enrich] "${item.title.slice(0, 60)}" — ${sourceMaterial.content.length} chars from ${sourceMaterial.urls[0]}`,
    );
  }

  console.log(`[enrich] ${enriched} enriched, ${dropped} dropped (no source content)`);
  return result;
}
