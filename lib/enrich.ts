import Anthropic from '@anthropic-ai/sdk';

import type { ScoredItem } from './scoring';

const MODEL = 'claude-sonnet-4-6';
// web_search_20250305 per CONVENTIONS §Appels LLM.
// The _20260209 sandbox caused systematic "Detection timed out after 25s" errors
// and ~24% token overhead — see lib/research.ts for the original investigation.
const WEB_SEARCH_VERSION = 'web_search_20250305';

// web_search results are fed back as tool_result blocks — actual token usage
// is ~10-15k per call despite what usage.input_tokens reports (~2.3k visible).
// 20s gap keeps us well under the 30k TPM free-tier limit (≤3 calls/min).
// TODO(maintainer, 2026-07-01): reduce once the account is on a higher usage tier.
const INTER_CALL_SLEEP_MS = 20_000;

// Max items to enrich per run. Limits cost + run time while still adding
// context where it matters most (top-scored items by definition).
const MAX_ENRICHED = 8;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// Items with a description longer than this are already self-sufficient.
const MIN_DESCRIPTION_LENGTH = 200;

// TextBlock type alias — Anthropic SDK types content blocks as a union.
type TextBlock = { type: 'text'; text: string };

/**
 * Should this item be enriched via web_search?
 *
 * Skip RSS primary sources (Role 2 — already authoritative/complete).
 * Skip items that already have enough context.
 */
function needsEnrichment(item: ScoredItem): boolean {
  if (item.source.startsWith('rss_')) return false;
  if ((item.description?.length ?? 0) >= MIN_DESCRIPTION_LENGTH) return false;
  return true;
}

/**
 * Enriches selected items with current web context via Sonnet + web_search.
 *
 * Items that don't need enrichment (primary sources, sufficient description)
 * are returned unchanged. Per CONVENTIONS §Pipeline règle 8: enrichment is
 * selective, not systematic. Failed enrichments fall back to the original item.
 */
export async function enrichItems(items: ScoredItem[]): Promise<ScoredItem[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing');

  const client = new Anthropic({ apiKey, maxRetries: 0 });
  const result: ScoredItem[] = [];
  let enrichedCount = 0;
  let skippedCount = 0;

  for (const item of items) {
    if (!needsEnrichment(item) || enrichedCount >= MAX_ENRICHED) {
      skippedCount++;
      result.push(item);
      continue;
    }

    // Throttle to respect the 30k TPM rate limit (web_search uses ~10-15k tokens/call).
    if (enrichedCount > 0) await sleep(INTER_CALL_SLEEP_MS);

    try {
      const context = await fetchContext(client, item);
      result.push({ ...item, description: context || item.description });
      enrichedCount++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[enrich] "${item.title.slice(0, 60)}" failed: ${msg}`);
      // Enrichment is best-effort — fall back to original item without crashing.
      result.push(item);
    }
  }

  console.log(
    `[enrich] ${enrichedCount} enriched, ${skippedCount} skipped (primary source or sufficient context)`,
  );
  return result;
}

async function fetchContext(client: Anthropic, item: ScoredItem): Promise<string> {
  const prompt =
    `Find current details about this AI story and return 2-3 sentences of key facts, ` +
    `numbers, and context that a product engineer would care about:\n\n` +
    `"${item.title}"\nURL: ${item.url}`;

  const response = await client.messages
    .stream({
      model: MODEL,
      max_tokens: 256,
      tools: [
        {
          // SDK types lag behind server-side Anthropic built-in tools — cast required.
          type: WEB_SEARCH_VERSION,
          name: 'web_search',
          max_uses: 2,
        } as never,
      ],
      messages: [{ role: 'user', content: prompt }],
    })
    .finalMessage();

  const text = response.content
    .filter((b): b is TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join(' ')
    .trim();

  console.log(
    `[enrich] "${item.title.slice(0, 50)}" — ` +
      `${response.usage.input_tokens}in/${response.usage.output_tokens}out tokens`,
  );

  return text;
}
