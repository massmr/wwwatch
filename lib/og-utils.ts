/**
 * lib/og-utils.ts — Shared utilities for next/og image routes.
 * No React/browser dependencies — safe to import in server contexts.
 */

// ── Category accent palette (PLAN_7 §1, validated) ───────────────────────────

const CATEGORY_ACCENT: Record<string, string> = {
  coding_agent: '#4ADE80',
  framework:    '#22D3EE',
  infra_api:    '#2DD4BF',
  research:     '#818CF8',
  tool:         '#94A3B8',
  funding:      '#34D399',
  security:     '#FBBF24',
  eval:         '#60A5FA',
  ops:          '#FB923C',
};

/** Returns the hex accent colour for a given article category. */
export function accentForCategory(cat: string): string {
  return CATEGORY_ACCENT[cat] ?? '#94A3B8';
}

// ── Font loading ──────────────────────────────────────────────────────────────

/** Font type matching next/og's FontOptions (weight as literal union). */
export type OgFont = {
  name: string;
  data: ArrayBuffer;
  style: 'normal' | 'italic';
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
};

// Module-level cache: fonts are fetched once per function instance and reused
// across requests. Eliminates the CDN round-trip on every OG image render,
// which fixes WhatsApp/Telegram timeouts on warm requests.
let fontCache: { interBold: ArrayBuffer | null; mono: ArrayBuffer | null } | null = null;

/** Loads Inter Bold 700 and JetBrains Mono 400 from Bunny Fonts CDN.
 *  Caches the result for the lifetime of the serverless function instance.
 *  Returns null for either font on fetch failure — OG image falls back to
 *  system fonts instead of throwing. */
export async function loadOgFonts(): Promise<{
  interBold: ArrayBuffer | null;
  mono: ArrayBuffer | null;
}> {
  if (fontCache) return fontCache;

  const [interBold, mono] = await Promise.all([
    fetch('https://fonts.bunny.net/inter/files/inter-latin-700-normal.woff')
      .then((r) => r.arrayBuffer())
      .catch((err) => { console.error('[og-utils] Inter font fetch failed:', err); return null; }),
    fetch('https://fonts.bunny.net/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff')
      .then((r) => r.arrayBuffer())
      .catch((err) => { console.error('[og-utils] JetBrains Mono font fetch failed:', err); return null; }),
  ]);

  fontCache = { interBold, mono };
  return fontCache;
}

// ── Title truncation ──────────────────────────────────────────────────────────

/**
 * Truncates a title to fit ~3 lines at 64px in the 1200×630 canvas.
 * Canvas available width: 1200 - 128px padding = 1072px.
 * Inter Bold at 64px ≈ 36px avg char width → ~30 chars/line → 90 for 3 lines.
 */
export function truncateOgTitle(title: string, maxChars = 88): string {
  if (title.length <= maxChars) return title;
  return title.slice(0, maxChars - 1).trimEnd() + '\u2026'; // '…'
}
