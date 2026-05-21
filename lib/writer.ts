import Anthropic from '@anthropic-ai/sdk';

import type { NewArticle } from './db';
import type { EnrichedItem } from './enrich';

const MODEL = 'claude-sonnet-4-6';

// Writer calls use ~1000-1500 input tokens (source material + prompt).
// 3s gap = ~20 calls/min = ~30k TPM — at the ceiling on free tier.
// Tier 2 allows higher TPM so this can be reduced; kept as a safe default.
const INTER_CALL_SLEEP_MS = 3_000;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// Closed set from CONVENTIONS §Modèle de données pipeline — must match DB CHECK constraint.
const VALID_CATEGORIES: ReadonlyArray<NewArticle['category']> = [
  'coding_agent', 'framework', 'infra_api', 'research', 'tool',
  'funding', 'security', 'eval', 'ops',
] as const;

function isValidCategory(value: string): value is NewArticle['category'] {
  return (VALID_CATEGORIES as readonly string[]).includes(value);
}

// TextBlock type alias — Anthropic SDK types content blocks as a union.
type TextBlock = { type: 'text'; text: string };

type ArticleJson = {
  slug: string;
  category: string;
  summary: string;
  body_md: string;
};

type WriteResult = {
  articles: NewArticle[];
  introMd: string;
  tokenUsage: { input: number; output: number };
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
    .replace(/-$/, '');
}

/**
 * Extracts a JSON object from a response that may contain surrounding text.
 * Uses lastIndexOf('}') — safe for nested braces in body_md.
 */
function extractJson(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) return text.slice(start, end + 1);
  return text;
}

function extractText(content: Anthropic.Messages.ContentBlock[]): string {
  return content
    .filter((b): b is TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n\n')
    .trim();
}

// ─── Prompts ─────────────────────────────────────────────────────────────────

const ARTICLE_PROMPT = (item: EnrichedItem): string => `\
You are writing an article for wwwatch, a daily AI journal for product engineers.

**SOURCE MATERIAL (the ONLY basis for your article):**
${item.sourceMaterial.content}

**Original story URL:** ${item.url}

**CRITICAL CONSTRAINT — SOURCE-ONLY WRITING:**
You MUST write ONLY from the source material above. Hard rules:
- Do NOT add details from your training knowledge that are absent from the source.
- If a detail is missing (supported models, exact benchmark scores, pricing, version numbers), either omit it or write exactly what the source says. Do NOT illustrate with examples not in the source.
- If the source says "model-agnostic" — write "model-agnostic". Do NOT list GPT-4o and Claude 3.5 Sonnet. That is fabrication.
- If the source is vague about a number — stay vague or omit. A plausible-sounding invented number is worse than no number.
- Every specific claim in your article must be directly traceable to a sentence in the source above.

**Writing instructions:**
Write a 300-500 word article in English markdown. Requirements:
- Lead with what changed and why it matters for builders — no "In this article" preamble
- Include specific numbers only if present in the source (benchmarks, pricing, speeds)
- Cite the source inline as a markdown link using the original URL
- End with a concrete implication: what should a developer do with this today?
- Direct tone, short sentences — product engineer to product engineer
- No bullet-point summaries at the top

**Respond with ONLY this JSON object (no code fence, no preamble):**
{"slug":"kebab-case-max-60-chars","category":"one-of-the-categories-below","summary":"1-2 sentences for newsletter preview","body_md":"full article markdown"}

Categories: coding_agent | framework | infra_api | research | tool | funding | security | eval | ops
- coding_agent: AI coding assistants, autonomous coding agents
- framework: LLM orchestration frameworks (LangChain, CrewAI, AutoGen, DSPy…)
- infra_api: Model APIs, inference infra, hosting, deployment platforms
- research: Papers, techniques, model architectures, new methods
- tool: Dev tools, utilities, plugins, integrations
- funding: Rounds, acquisitions, business moves
- security: Vulnerabilities, safety research, red-teaming, compliance
- eval: Benchmarks, evaluations, model comparisons
- ops: Observability, cost management, deployment, governance`;

// Correction v3.1: intro generated LAST, from final article summaries only.
// It must not reference anything not present in the final articles.
const INTRO_PROMPT = (day: string, summaries: Array<{ title: string; summary: string; category: string }>): string => `\
Write a 2-3 sentence intro for today's wwwatch edition (${day}).

**Today's articles (the ONLY source you may reference):**
${summaries.map((a) => `- [${a.category}] ${a.title}: ${a.summary}`).join('\n')}

Requirements:
- Reference only content present in the articles above — do NOT mention models, tools, or events not listed.
- Direct, no hype — for product engineers short on time
- Pick 1-2 specific highlights that stand out today
- No "Here's what happened today" openers
- ~80-100 words, in English

Respond with just the intro text (no JSON, no heading).`;

// ─── Per-article writer ───────────────────────────────────────────────────────

async function writeArticle(
  client: Anthropic,
  item: EnrichedItem,
  day: string,
): Promise<{ article: NewArticle | null; inputTokens: number; outputTokens: number }> {
  const response = await client.messages
    .stream({
      model: MODEL,
      max_tokens: 1500,
      messages: [{ role: 'user', content: ARTICLE_PROMPT(item) }],
    })
    .finalMessage();

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const raw = extractText(response.content);

  let parsed: ArticleJson;
  try {
    parsed = JSON.parse(extractJson(raw)) as ArticleJson;
  } catch {
    console.error(`[writer] JSON parse failed for "${item.title.slice(0, 60)}"`);
    return { article: null, inputTokens, outputTokens };
  }

  const slug = parsed.slug?.trim() || slugify(item.title);
  const bodyMd = parsed.body_md?.trim();
  const summary = parsed.summary?.trim();
  const category = parsed.category?.trim() ?? '';

  if (!slug || !bodyMd || !summary || !category) {
    console.error(`[writer] incomplete JSON for "${item.title.slice(0, 60)}"`);
    return { article: null, inputTokens, outputTokens };
  }

  if (!isValidCategory(category)) {
    console.error(`[writer] invalid category "${category}" for "${item.title.slice(0, 60)}"`);
    return { article: null, inputTokens, outputTokens };
  }

  // Guard: model produced a meta-article about its own inability to write
  // (e.g. "Source Unavailable", "Article Could Not Be Generated").
  // These happen when source content was binary or JS-gated — the item should
  // have been dropped in enrich, but if it slips through, don't store it.
  const META_ARTICLE_SLUG_RE = /unavailable|unreadable|could.not|no.content|no.article/i;
  if (META_ARTICLE_SLUG_RE.test(slug) || META_ARTICLE_SLUG_RE.test(bodyMd.slice(0, 200))) {
    console.error(`[writer] meta-article detected and rejected for "${item.title.slice(0, 60)}"`);
    return { article: null, inputTokens, outputTokens };
  }

  const article: NewArticle = {
    day,
    slug,
    title: item.title,
    category,
    summary,
    bodyMd,
    sources: item.sourceMaterial.urls.map((url) => ({
      url,
      source: item.source,
      title: item.title,
    })),
    fingerprint: item.fingerprint,
    score: item.score,
  };

  return { article, inputTokens, outputTokens };
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Writes articles for each enriched item, then generates the edition intro.
 *
 * Correction v3.1:
 * - Each article is written ONLY from its fetched source_material.
 * - The intro is generated LAST from the final article summaries.
 *   It must not reference anything outside the produced articles.
 */
export async function writeArticles(items: EnrichedItem[], day: string): Promise<WriteResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing');

  const client = new Anthropic({ apiKey, maxRetries: 0 });

  const articles: NewArticle[] = [];
  let totalInput = 0;
  let totalOutput = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    if (i > 0) await sleep(INTER_CALL_SLEEP_MS);

    try {
      const { article, inputTokens, outputTokens } = await writeArticle(client, item, day);
      totalInput += inputTokens;
      totalOutput += outputTokens;
      if (article) {
        articles.push(article);
        console.log(
          `[writer] "${article.slug}" [${article.category}] — ${inputTokens}in/${outputTokens}out`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[writer] "${item.title.slice(0, 60)}" failed: ${msg}`);
      // Per CONVENTIONS: no naive retry on LLM failures — log and continue.
    }
  }

  // Correction v3.1: generate intro LAST, from the summaries of the articles
  // we actually produced. Never from raw items or in parallel with article writes.
  let introMd = '';
  if (articles.length > 0) {
    await sleep(INTER_CALL_SLEEP_MS);
    try {
      const summaries = articles.map((a) => ({
        title: a.title,
        summary: a.summary,
        category: a.category,
      }));
      const introResponse = await client.messages
        .stream({
          model: MODEL,
          max_tokens: 256,
          messages: [{ role: 'user', content: INTRO_PROMPT(day, summaries) }],
        })
        .finalMessage();
      introMd = extractText(introResponse.content);
      totalInput += introResponse.usage.input_tokens;
      totalOutput += introResponse.usage.output_tokens;
      console.log(
        `[writer] intro — ${introResponse.usage.input_tokens}in/${introResponse.usage.output_tokens}out`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[writer] intro failed: ${msg}`);
    }
  }

  return { articles, introMd, tokenUsage: { input: totalInput, output: totalOutput } };
}
