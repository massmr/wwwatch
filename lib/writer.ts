import Anthropic from '@anthropic-ai/sdk';

import type { NewArticle } from './db';
import type { ScoredItem } from './scoring';

const MODEL = 'claude-sonnet-4-6';

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
 * Uses lastIndexOf('}') to find the outermost closing brace — the fenced-code
 * approach (regex) is not used because body_md contains nested braces that
 * would confuse a non-greedy match.
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

// ─── Article writing ─────────────────────────────────────────────────────────

const ARTICLE_PROMPT = (item: ScoredItem): string => `\
You are writing an article for wwwatch, a daily AI journal for product engineers.

**Story:**
Title: ${item.title}
Source: ${item.url}
${item.description ? `Context: ${item.description}` : '(No additional context)'}

**Instructions:**
Write a 300-500 word article in English markdown. Requirements:
- Lead with what changed and why it matters for builders — no "In this article" preamble
- Include specific numbers (benchmarks, pricing, speed, sizes) if available in the context
- Cite the source inline as a markdown link
- End with a concrete implication: what should a developer do with this today?
- Direct tone, short sentences — product engineer talking to product engineers
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

const INTRO_PROMPT = (day: string, articles: NewArticle[]): string => `\
Write a 2-3 sentence intro for today's wwwatch edition (${day}).

Today's issue covers:
${articles.map((a) => `- ${a.title} [${a.category}]`).join('\n')}

Requirements:
- Direct, no hype — for product engineers short on time
- Reference 1-2 specific highlights from today's articles
- No "Here's what happened today" openers
- End with what builders should pay close attention to
- ~80-100 words, in English

Respond with just the intro text (no JSON, no heading).`;

async function writeArticle(
  client: Anthropic,
  item: ScoredItem,
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

  const article: NewArticle = {
    day,
    slug,
    title: item.title,
    category,
    summary,
    bodyMd,
    sources: [{ url: item.url, source: item.source, title: item.title }],
    fingerprint: item.fingerprint,
    score: item.score,
  };

  return { article, inputTokens, outputTokens };
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Writes articles for each scored item, then generates the edition intro.
 * Uses Sonnet for all calls — per CONVENTIONS §Pipeline règle 9.
 * Failed articles are logged and skipped (partial success is acceptable).
 */
export async function writeArticles(items: ScoredItem[], day: string): Promise<WriteResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing');

  const client = new Anthropic({ apiKey, maxRetries: 0 });

  const articles: NewArticle[] = [];
  let totalInput = 0;
  let totalOutput = 0;

  for (const item of items) {
    try {
      const { article, inputTokens, outputTokens } = await writeArticle(client, item, day);
      totalInput += inputTokens;
      totalOutput += outputTokens;
      if (article) {
        articles.push(article);
        console.log(`[writer] "${article.slug}" [${article.category}] — ${inputTokens}in/${outputTokens}out`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[writer] "${item.title.slice(0, 60)}" failed: ${msg}`);
      // Per CONVENTIONS: no naive retry on LLM failures — log and continue.
    }
  }

  // Generate the edition intro from the articles we actually produced.
  let introMd = '';
  if (articles.length > 0) {
    try {
      const introResponse = await client.messages
        .stream({
          model: MODEL,
          max_tokens: 256,
          messages: [{ role: 'user', content: INTRO_PROMPT(day, articles) }],
        })
        .finalMessage();
      introMd = extractText(introResponse.content);
      totalInput += introResponse.usage.input_tokens;
      totalOutput += introResponse.usage.output_tokens;
      console.log(`[writer] intro — ${introResponse.usage.input_tokens}in/${introResponse.usage.output_tokens}out`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[writer] intro failed: ${msg}`);
      // Intro is non-critical — edition can publish without it.
    }
  }

  return { articles, introMd, tokenUsage: { input: totalInput, output: totalOutput } };
}
