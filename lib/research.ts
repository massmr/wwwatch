import Anthropic from '@anthropic-ai/sdk';

import { buildPrompt } from './prompt';

const MODEL = 'claude-opus-4-6';
const MAX_RETRIES = 2;

// At module scope — type alias used in the response parsing below.
type TextBlock = { type: 'text'; text: string };

/** Calls the Anthropic API with web_search and returns the brief as markdown. */
export async function generateBriefMarkdown(maxUses = 5): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY manquant');

  // maxRetries: 0 — we handle retries manually below to distinguish transient
  // network errors (retryable) from logic errors (non-retryable).
  const client = new Anthropic({ apiKey, maxRetries: 0 });
  const prompt = buildPrompt(new Date());

  console.log(`[research] Appel ${MODEL} avec web_search (max_uses=${maxUses})...`);
  const start = Date.now();

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      // stream() uses SSE (keep-alive) — avoids timeout on long tool-use chains.
      const response = await client.messages.stream({
        model: MODEL,
        max_tokens: 8192,
        tools: [
          {
            // SDK not always up to date on server tool types — cast required.
            // Downgraded from web_search_20260209 : le sandbox de dynamic
            // filtering causait des "Detection timed out after 25s" systématiques.
            // web_search_20250305 est sans sandbox, plus fiable (~24% tokens en plus).
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: maxUses,
          } as never,
        ],
        messages: [{ role: 'user', content: prompt }],
      }).finalMessage();

      console.log(`[research] OK en ${((Date.now() - start) / 1000).toFixed(1)}s`);

      const text = response.content
        .filter((b): b is TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n\n')
        .trim();

      // Not retryable — the model responded but produced no text.
      if (!text) throw new Error("Claude n'a rien retourné");

      const usage = response.usage;
      console.log(
        `[research] tokens in=${usage.input_tokens} out=${usage.output_tokens}`
      );

      return text;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      // Non-retryable: the model ran fine but returned empty content.
      if (msg === "Claude n'a rien retourné") throw err;

      lastErr = err;
      if (attempt <= MAX_RETRIES) {
        console.warn(`[research] Tentative ${attempt} échouée (${msg}), retry...`);
      }
    }
  }

  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(`[research] Échec après ${MAX_RETRIES + 1} tentatives : ${msg}`);
}
