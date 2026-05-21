import { normalizeFingerprint } from './collectors/types';
import type { NewArticle } from './db';

export type ArticleFlag = {
  slug: string;
  flags: string[];
};

const MIN_WORD_COUNT = 200;

/**
 * Runs quality checks on generated articles before they're stored.
 *
 * Flags (never deletes silently) articles that are:
 * - Too short (< 200 words)
 * - Missing a verifiable source URL
 * - Semantic duplicate within this batch (same fingerprint)
 * - Semantic duplicate with a recently-published article (inter-day)
 *
 * A flagged article remains draft — per CONVENTIONS §Pipeline règle 5,
 * the human reviews flags before publishing.
 */
export function checkArticles(
  articles: NewArticle[],
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

    // 3. Intra-batch duplicate (same fingerprint in this edition).
    const fp = normalizeFingerprint(article.title);
    if (batchFps.has(fp)) {
      flags.push('duplicate_batch');
    }
    batchFps.add(fp);

    // 4. Inter-day duplicate (same fingerprint as a recently published article).
    if (recentFpSet.has(fp)) {
      flags.push('duplicate_recent');
    }

    if (flags.length > 0) {
      results.push({ slug: article.slug, flags });
    }
  }

  return results;
}
