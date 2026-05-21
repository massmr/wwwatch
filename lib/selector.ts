import Anthropic from '@anthropic-ai/sdk';

import type { EnrichedItem } from './enrich';
import { buildSelectionPrompt } from './prompt';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SelectionCandidate = {
  id: string;
  title: string;
  source: string;
  // NOTE: category is not assigned until the writer runs, so it is unavailable
  // here. The source field (e.g. 'github', 'rss_openai', 'hacker_news') gives
  // the selector equivalent context about provenance.
  snippet: string; // ~350 first chars of enriched content
};

export type SelectionResult = {
  selected: { id: string; reason: string }[];
  dropped: { id: string; reason: string }[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const MODEL = 'claude-sonnet-4-6';
const SELECTION_CAP = 8;
const FALLBACK_N = 6;
const SNIPPET_LENGTH = 350;

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Runs the editorial selection step: one Sonnet call that keeps at most 8
 * items passing the wwwatch filter ("does this change what a product engineer
 * builds this week?"). Defensive parsing with three guard-rails:
 *   1. Intersection with real IDs (hallucinated IDs discarded).
 *   2. Cap enforced in code (never trusts the model count).
 *   3. Fallback to top-6 by score if JSON is unparsable.
 */
export async function selectEditorial(enriched: EnrichedItem[]): Promise<SelectionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing');

  const candidates: SelectionCandidate[] = enriched.map((item) => ({
    id: item.id,
    title: item.title,
    source: item.source,
    snippet: item.sourceMaterial.content.slice(0, SNIPPET_LENGTH),
  }));

  // The set of valid IDs, used for intersection after parsing.
  const validIds = new Set(candidates.map((c) => c.id));

  const client = new Anthropic({ apiKey, maxRetries: 0 });

  let raw: string;
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: buildSelectionPrompt(candidates) }],
    });
    const block = response.content.find(
      (b): b is Anthropic.Messages.TextBlock => b.type === 'text',
    );
    raw = block?.text ?? '';
    console.log(
      `[selector] LLM call -- ${response.usage.input_tokens}in/${response.usage.output_tokens}out`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[selector] API call failed: ${msg}`);
    console.error('[selector] parse failed, fell back to top-6 by score');
    return fallbackTopN(enriched, FALLBACK_N);
  }

  // Strip markdown fences that the model may add despite instructions.
  const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  type RawResult = { selected: unknown; dropped: unknown };
  let parsed: RawResult;
  try {
    // JSON.parse returns `any`; fields are `unknown` so we narrow before use below.
    parsed = JSON.parse(jsonStr) as RawResult;
  } catch {
    console.error('[selector] parse failed, fell back to top-6 by score');
    return fallbackTopN(enriched, FALLBACK_N);
  }

  // Guard-rail 1 + 2: intersect with known IDs, enforce cap.
  const isValidEntry = (x: unknown): x is { id: string; reason: string } =>
    typeof x === 'object' &&
    x !== null &&
    typeof (x as Record<string, unknown>).id === 'string' &&
    validIds.has((x as { id: string }).id);

  const rawSelected = Array.isArray(parsed.selected) ? parsed.selected : [];
  const rawDropped = Array.isArray(parsed.dropped) ? parsed.dropped : [];

  const validSelected = rawSelected.filter(isValidEntry);
  const selected: { id: string; reason: string }[] = validSelected.slice(0, SELECTION_CAP); // guard-rail 2: cap in code

  const selectedIds = new Set(selected.map((s) => s.id));

  const dropped: { id: string; reason: string }[] = rawDropped.filter(isValidEntry);

  // Any valid ID the model omitted entirely goes into dropped.
  for (const id of validIds) {
    if (!selectedIds.has(id) && !dropped.some((d) => d.id === id)) {
      dropped.push({ id, reason: 'not mentioned by selector' });
    }
  }

  // Guard-rail 3: warn on zero selections (quiet day is allowed, but flag it).
  if (selected.length === 0) {
    console.warn('[selector] 0 items selected -- quiet day, edition will be near-empty');
  }

  const capNote = validSelected.length > SELECTION_CAP ? ` (cap ${SELECTION_CAP})` : '';
  console.log(
    `[selector] ${candidates.length} candidates -> ${selected.length} selected, ${dropped.length} dropped${capNote}`,
  );
  for (const s of selected) {
    console.log(`  keep  ${s.id} -- ${s.reason}`);
  }
  for (const d of dropped) {
    console.log(`  drop  ${d.id} -- ${d.reason}`);
  }

  return { selected, dropped };
}

// ─── Fallback ─────────────────────────────────────────────────────────────────

function fallbackTopN(enriched: EnrichedItem[], n: number): SelectionResult {
  const sorted = [...enriched].sort((a, b) => b.score - a.score);
  const selected = sorted.slice(0, n).map((item) => ({
    id: item.id,
    reason: 'fallback: top by score',
  }));
  const dropped = sorted.slice(n).map((item) => ({
    id: item.id,
    reason: 'below fallback cutoff',
  }));
  return { selected, dropped };
}
