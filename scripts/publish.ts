/**
 * scripts/publish.ts — Publish a draft edition.
 *
 * Transitions an edition from status='draft' → status='published',
 * then optionally triggers a Vercel deploy hook to revalidate cached pages.
 *
 * Usage:
 *   npm run publish -- 2026-05-21
 *
 * Requires DATABASE_URL in environment (loaded from .env.local via npm script).
 * Optional: VERCEL_DEPLOY_HOOK_URL — if set, triggers a rebuild so 'use cache'
 * pages reflect the new edition. Configure this in Phase 6.
 */
import { getEdition, publishEdition } from '@/lib/db';

const day = process.argv[2]?.trim();

if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
  console.error('[publish] Usage: npm run publish -- YYYY-MM-DD');
  process.exit(1);
}

async function main(): Promise<void> {
  const edition = await getEdition(day!);

  if (!edition) {
    console.error(`[publish] No edition found for ${day}`);
    process.exit(1);
  }

  if (edition.status === 'published') {
    console.warn(`[publish] ${day} is already published — nothing to do`);
    return;
  }

  console.log(
    `[publish] Publishing ${day} — ${edition.article_count} articles, ${edition.articles.length} loaded`,
  );

  await publishEdition(day!);
  console.log(`[publish] ${day} → published ✓`);

  // Trigger Vercel cache revalidation.
  // TODO(maintainer, 2026-06-01): set VERCEL_DEPLOY_HOOK_URL in Phase 6 (Vercel dashboard
  // → Project → Settings → Git → Deploy Hooks). Non-fatal if missing.
  const hookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (hookUrl) {
    try {
      const res = await fetch(hookUrl, { method: 'POST' });
      if (res.ok) {
        console.log('[publish] deploy hook triggered — Vercel rebuild scheduled');
      } else {
        console.warn(`[publish] deploy hook returned HTTP ${res.status} — rebuild may not have triggered`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Non-fatal: the edition is published in DB even if the hook fails.
      console.warn(`[publish] deploy hook failed (non-fatal): ${msg}`);
    }
  } else {
    console.log('[publish] VERCEL_DEPLOY_HOOK_URL not set');
    console.log('[publish] Trigger a Vercel redeploy manually or set the hook URL to auto-revalidate');
  }

  console.log(`[publish] Done. Review at: /journal/${day}`);
}

main().catch((err) => {
  console.error('[publish] fatal:', err);
  process.exit(1);
});
