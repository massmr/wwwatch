import type { RawItem } from './collectors/types';

export type ScoredItem = Omit<RawItem, 'score'> & {
  /** Composite score in [0, ∞). Values > 1.0 are possible via cross-source ×1.5. */
  score: number;
};

const TOP_N = 20;

// ─── Authority weights ────────────────────────────────────────────────────────

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

// ─── Event freshness ──────────────────────────────────────────────────────────
//
// Correction v3.1: "event_freshness" is NOT just recency. It answers:
// "Is there a datable event (release, version, funding, incident, breaking
// change, announcement) in the last 7 days?" A popular but static GitHub
// repo without a recent event scores low even at 100k stars.
//
// Non-GitHub sources (HN, Reddit, HF, RSS) ARE events by construction —
// they are freshly-posted links or papers. For those, freshness = recency.
// GitHub repos require an explicit event signal in title/description.

// Regex that signals a specific version/release event in the title or description.
// "\bnew \w+\b" removed — too broad (any "new framework for X" would match,
// defeating the anti-static-repo heuristic for GitHub items).
const EVENT_KEYWORD_RE =
  /\bv\d|\brelease\b|\blaunch(es|ed|ing)?\b|\bannounce(s|d|ment)?\b|\bintroduce(s|d)?\b|\bship(s|ped|ping)?\b|\bbreaking\b|\bupdate\b|\d+\.\d+/i;

function eventFreshnessScore(item: RawItem): number {
  const ageHours = (Date.now() - new Date(item.published_at).getTime()) / 3_600_000;

  if (item.source !== 'github') {
    // HN / Reddit / HF / RSS = events by nature. 48h decay window.
    return Math.max(0, 1 - ageHours / 48);
  }

  // GitHub: check for an explicit event signal in title + description.
  const text = `${item.title} ${item.description ?? ''}`;
  const hasEvent = EVENT_KEYWORD_RE.test(text);

  if (!hasEvent) {
    // Established repo without a recent event: penalise heavily.
    // 7-day window (repos get noticed later), ×0.25 ceiling.
    return Math.max(0, 1 - ageHours / 168) * 0.25;
  }

  // Repo with an event signal: 7-day window, no penalty.
  return Math.max(0, 1 - ageHours / 168);
}

// ─── Engagement ───────────────────────────────────────────────────────────────
//
// Correction v3.1: use log1p to cap the outsized influence of mega-repos.
// log1p(187_000) / log1p(10_000) ≈ 1.3 → capped at 1.0.
// A 10k-star repo and a 180k-star repo get the same engagement score.

function engagementScore(item: RawItem): number {
  switch (item.source) {
    case 'hacker_news':
      return Math.min(Math.log1p(item.upvotes ?? 0) / Math.log1p(500), 1);
    case 'github':
      return Math.min(Math.log1p(item.stars ?? 0) / Math.log1p(10_000), 1);
    case 'hugging_face':
      return Math.min((item.upvotes ?? 0) / 200, 1);
    default:
      if (item.source.startsWith('reddit_'))
        return Math.min(Math.log1p(item.upvotes ?? 0) / Math.log1p(500), 1);
      if (item.source.startsWith('rss_'))
        return 0.5; // primary sources have no engagement signal — default mid
      return 0.3;
  }
}

// ─── Keyword relevance ────────────────────────────────────────────────────────

const AGENTIC_KEYWORDS = [
  'agent', 'agentic', 'llm', 'gpt', 'claude', 'gemini', 'anthropic',
  'openai', 'copilot', 'rag', 'reasoning', 'fine-tun', 'benchmark',
  'eval', 'mcp', 'tool use', 'function call', 'multimodal',
];

function keywordScore(item: RawItem): number {
  const text = `${item.title} ${item.description ?? ''}`.toLowerCase();
  const hits = AGENTIC_KEYWORDS.filter((kw) => text.includes(kw)).length;
  return Math.min(hits / 3, 1);
}

// ─── Composite score ──────────────────────────────────────────────────────────
//
// v3.1 formula: event_freshness×0.45 + authority×0.25 + engagement×0.20 + keywords×0.10
// (was: engagement×0.4 + freshness×0.3 + authority×0.2 + keywords×0.1)
//
// Rationale: the v3.0 dry-run returned 4/5 GitHub repos (popular but not news).
// Bumping event_freshness to 0.45 and penalising eventless repos fixes the ordering.

function baseScore(item: RawItem): number {
  return (
    eventFreshnessScore(item) * 0.45 +
    getAuthority(item.source) * 0.25 +
    engagementScore(item) * 0.20 +
    keywordScore(item) * 0.10
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Scores raw items, deduplicates within the run, applies the cross-source ×1.5
 * bonus, removes inter-day duplicates, and returns the top N.
 *
 * Returns:
 * - `top`  — items selected for writing (≤ TOP_N)
 * - `all`  — every scored item, for persisting to raw_items (audit trail)
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

  // Log the top 5 for visibility in dry-run.
  top.slice(0, 5).forEach((item, i) => {
    console.log(`  #${i + 1} [${item.source}] score=${item.score} "${item.title.slice(0, 60)}"`);
  });

  return { top, all };
}
