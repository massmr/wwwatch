import { normalizeFingerprint, type RawItem } from './types';

const HF_API = 'https://huggingface.co/api/daily_papers';
const TIMEOUT_MS = 10_000;

// Agentic AI keywords — used to prioritise papers, not filter them out.
// All HF daily papers are already curated so we include everything.
const AGENTIC_KEYWORDS = [
  'agent', 'llm', 'language model', 'reasoning', 'tool use',
  'code generation', 'rag', 'retrieval', 'instruction',
];

type HfPaper = {
  id?: string;
  title?: string;
  summary?: string;
  upvotes?: number;
  publishedAt?: string;
  submittedOnDailyPaperAt?: string;
  // The API sometimes nests paper details under a `.paper` key.
  paper?: {
    id?: string;
    title?: string;
    summary?: string;
    upvotes?: number;
  };
};

/**
 * Collects today's papers from the Hugging Face Daily Papers page.
 * All curated papers are included (no score filter — HF curation is the filter).
 * Papers with agentic keywords get a `description` flag for scoring.ts to
 * apply the authority bonus in Phase 3.
 */
export async function collectHuggingFace(): Promise<RawItem[]> {
  let data: unknown;
  try {
    const res = await fetch(HF_API, {
      headers: { 'User-Agent': 'wwwatch/1.0 (daily pipeline)' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    data = await res.json();
  } catch (err) {
    console.error('[collectors] hugging_face fetch error:', err);
    return [];
  }

  if (!Array.isArray(data)) {
    console.error('[collectors] hugging_face unexpected response shape (expected array)');
    return [];
  }

  const items: RawItem[] = [];

  // HfPaper fields are all optional — missing/unexpected fields are handled
  // per-entry below. The cast avoids re-checking every key after Array.isArray.
  for (const entry of data as HfPaper[]) {
    // Normalise nested vs flat structure.
    const paperId = entry.paper?.id ?? entry.id;
    const title = entry.paper?.title ?? entry.title;
    const summary = entry.paper?.summary ?? entry.summary;
    const upvotes = entry.paper?.upvotes ?? entry.upvotes;
    const publishedAt = entry.submittedOnDailyPaperAt ?? entry.publishedAt;

    if (!paperId || !title) continue;

    const arxivUrl = `https://arxiv.org/abs/${paperId}`;

    items.push({
      id: `hf_${paperId.replace(/[^a-z0-9]/gi, '_')}`,
      source: 'hugging_face',
      title,
      url: arxivUrl,
      description: summary ?? null,
      published_at: publishedAt ?? new Date().toISOString(),
      upvotes: upvotes ?? null,
      score: null,
      fingerprint: normalizeFingerprint(title),
    });
  }

  // Log keyword coverage for dry-run visibility.
  const agenticCount = items.filter((i) =>
    AGENTIC_KEYWORDS.some((kw) => i.title.toLowerCase().includes(kw))
  ).length;
  console.log(
    `[collectors] hugging_face: ${items.length} papers, ${agenticCount} agentic-keyword matches`
  );

  return items;
}
