import { normalizeFingerprint } from './collectors/types';
import type { NewArticle } from './db';

export type ArticleFlag = {
  slug: string;
  flags: string[];
};

const MIN_WORD_COUNT = 200;

// Patterns that suggest specific factual claims (model names, versions, numbers).
// These must be traceable to the source_material.
const FACTUAL_PATTERN_RE = /\b(gpt-[\w.]+|claude[\s-][\w.]+|gemini[\s-][\w.]+|llama[\s-][\w.]+|v\d+\.\d+|\d+[kmb]?\s*(stars?|tokens?|params?|dollars?|\$)|\d+\.?\d*%)\b/gi;

/**
 * Runs quality checks on generated articles.
 *
 * Flags (never deletes silently) articles that fail any check.
 *
 * Correction v3.1: adds `unsourced_detail` flag. Any model name, version
 * number, benchmark percentage, or dollar figure cited in the article should
 * be traceable to the source_material. The heuristic is imperfect — human
 * review is the authoritative safety net (CONVENTIONS §Pipeline règles 4&5).
 */
export function checkArticles(
  articles: Array<NewArticle & { sourceMaterial?: string }>,
  recentFingerprints: string[],
): ArticleFlag[] {
  const recentFpSet = new Set(recentFingerprints);
  const batchFps = new Set<string>();
  const results: ArticleFlag[] = [];

  for (const article of articles) {
    const flags: string[] = [];

    // 1. Word count.
    const wordCount = article.bodyMd.split(/\s+/).filter(Boolean).length;
    if (wordCount < MIN_WORD_COUNT) {
      flags.push(`too_short (${wordCount}w, min ${MIN_WORD_COUNT})`);
    }

    // 2. Source verification.
    if (article.sources.length === 0) {
      flags.push('no_source');
    } else {
      const hasVerifiableUrl = article.sources.some((s) => {
        try {
          new URL(s.url);
          return true;
        } catch {
          // Intentional: URL() throws on invalid strings — the catch is the validation.
          return false;
        }
      });
      if (!hasVerifiableUrl) flags.push('source_url_invalid');
    }

    // 3. Intra-batch duplicate.
    const fp = normalizeFingerprint(article.title);
    if (batchFps.has(fp)) flags.push('duplicate_batch');
    batchFps.add(fp);

    // 4. Inter-day duplicate.
    if (recentFpSet.has(fp)) flags.push('duplicate_recent');

    // 5. Non-editorialized title: title was not rewritten and still matches
    //    the raw source title. Exact signal of the PLAN_4 bug.
    //    NOTE: strict equality after normalization — not fuzzy. Catches the
    //    exact pattern (verbatim item.title copied to articles.title). A
    //    near-match heuristic would reduce false negatives but adds complexity
    //    not needed at MVP volume. Revisit if partial copies slip through.
    const sourceTitle = article.sources[0]?.title;
    if (sourceTitle) {
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
      if (norm(article.title) === norm(sourceTitle)) {
        flags.push('non_editorialized_title');
      }
    }

    // 6. Unsourced factual detail (Correction v3.1).
    //    Extract specific claims from the article and check they appear in
    //    the source material. Heuristic — not exhaustive — but catches the
    //    most common fabrication pattern (model names, version numbers, %s).
    if (article.sourceMaterial) {
      const articleMatches = [...article.bodyMd.matchAll(FACTUAL_PATTERN_RE)].map((m) =>
        m[0].toLowerCase(),
      );
      const sourceText = article.sourceMaterial.toLowerCase();
      const unsourced = articleMatches.filter((fact) => !sourceText.includes(fact));
      if (unsourced.length > 0) {
        // Deduplicate before flagging.
        const uniqueUnsourced = [...new Set(unsourced)];
        flags.push(`unsourced_detail: ${uniqueUnsourced.slice(0, 3).join(', ')}`);
      }
    }

    if (flags.length > 0) {
      results.push({ slug: article.slug, flags });
    }
  }

  return results;
}
