import type { RawItem } from './collectors/types';

export type ScoredItem = Omit<RawItem, 'score'> & {
  /** Composite score in [0, ∞). Values > 1.0 are possible via cross-source ×1.5. */
  score: number;
};

const TOP_N = 20;

// ─── Authority weights ────────────────────────────────────────────────────────
// Role 2 primary sources (official changelogs/blogs) get full authority.
// Catch-alls: rss_* → 0.75, reddit_* → 0.4, default → 0.4.

const AUTHORITY: Record<string, number> = {
  hacker_news: 0.6,
  github: 0.5,
  hugging_face: 0.9,
  rss_openai: 1.0,
  rss_anthropic: 1.0,
  rss_github: 0.9,
  rss_vercel: 0.85,
  rss_microsoft_ai: 0.85,
};

function getAuthority(source: string): number {
  if (source in AUTHORITY) return AUTHORITY[source]!;
  if (source.startsWith('rss_')) return 0.75;
  if (source.startsWith('reddit_')) return 0.4;
  return 0.4;
}

// ─── Sub-score functions ──────────────────────────────────────────────────────

function engagementScore(item: RawItem): number {
  switch (item.source) {
    case 'hacker_news':
      return Math.min((item.upvotes ?? 0) / 500, 1);
    case 'github':
      // Total stars (GitHub has no public "stars today" API).
      return Math.min((item.stars ?? 0) / 50_000, 1);
    case 'hugging_face':
      return Math.min((item.upvotes ?? 0) / 200, 1);
    default:
      if (item.source.startsWith('reddit_'))
        return Math.min((item.upvotes ?? 0) / 500, 1);
      if (item.source.startsWith('rss_'))
        // Primary sources have no engagement signal — default to mid.
        return 0.5;
      return 0.3;
  }
}

function freshnessScore(publishedAt: string): number {
  const ageHours = (Date.now() - new Date(publishedAt).getTime()) / 3_600_000;
  // Linear decay: 0h → 1.0, 48h → 0.0.
  return Math.max(0, 1 - ageHours / 48);
}

// Keywords that signal agentic AI relevance.
const AGENTIC_KEYWORDS = [
  'agent', 'agentic', 'llm', 'gpt', 'claude', 'gemini', 'anthropic',
  'openai', 'copilot', 'rag', 'reasoning', 'fine-tun', 'benchmark',
  'eval', 'mcp', 'tool use', 'function call', 'multimodal',
];

function keywordScore(item: RawItem): number {
  const text = `${item.title} ${item.description ?? ''}`.toLowerCase();
  const hits = AGENTIC_KEYWORDS.filter((kw) => text.includes(kw)).length;
  // Cap at 3 keyword matches — diminishing returns beyond that.
  return Math.min(hits / 3, 1);
}

function baseScore(item: RawItem): number {
  return (
    engagementScore(item) * 0.4 +
    freshnessScore(item.published_at) * 0.3 +
    getAuthority(item.source) * 0.2 +
    keywordScore(item) * 0.1
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Scores raw items, deduplicates within the run, applies the cross-source ×1.5
 * bonus, removes inter-day duplicates, and returns the top N.
 *
 * Returns:
 * - `top` — items selected for writing (≤ TOP_N)
 * - `all` — every scored item, for persisting to raw_items (audit trail)
 */
export function scoreItems(
  items: RawItem[],
  recentFingerprints: string[],
): { top: ScoredItem[]; all: ScoredItem[] } {
  // 1. Group by exact fingerprint — same fingerprint = same story.
  const fpGroups = new Map<string, RawItem[]>();
  for (const item of items) {
    const group = fpGroups.get(item.fingerprint) ?? [];
    group.push(item);
    fpGroups.set(item.fingerprint, group);
  }

  const crossSourceFps = new Set(
    [...fpGroups.entries()]
      .filter(([, g]) => g.length > 1)
      .map(([fp]) => fp),
  );

  // 2. Within each fingerprint group, keep the highest-authority item.
  const deduped: RawItem[] = [...fpGroups.values()].map((group) =>
    group.reduce((best, cur) =>
      getAuthority(cur.source) > getAuthority(best.source) ? cur : best,
    ),
  );

  // 3. Score + apply cross-source bonus.
  const all: ScoredItem[] = deduped.map((item) => {
    const score = baseScore(item) * (crossSourceFps.has(item.fingerprint) ? 1.5 : 1);
    return { ...item, score: parseFloat(score.toFixed(4)) };
  });

  // 4. Inter-day dedup — skip stories already published recently.
  const recentSet = new Set(recentFingerprints);
  const fresh = all.filter((item) => !recentSet.has(item.fingerprint));

  const stale = all.length - fresh.length;
  if (stale > 0) console.log(`[scoring] ${stale} items skipped (covered in last 3 days)`);

  // 5. Sort descending and take top N.
  const sorted = [...fresh].sort((a, b) => b.score - a.score);
  const top = sorted.slice(0, TOP_N);

  console.log(
    `[scoring] ${items.length} raw → ${deduped.length} deduped → ` +
      `${fresh.length} fresh → top ${top.length} ` +
      `(${crossSourceFps.size} cross-source groups)`,
  );

  return { top, all };
}
