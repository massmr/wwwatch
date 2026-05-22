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
import { EDITION_PUBLISHED } from '@/lib/analytics-events';
import { getEdition, listPublishedDates, publishEdition } from '@/lib/db';
import { buildMirrorFiles, pushMirrorFiles, type MirrorArticle } from '@/lib/mirror';
import { createPostHogServer } from '@/lib/posthog-server';

const DRY_RUN = process.env.DRY_RUN === '1';

const day = process.argv[2]?.trim();

if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
  console.error('[publish] Usage: npm run publish -- YYYY-MM-DD');
  process.exit(1);
}

/**
 * Generates and optionally pushes the GitHub mirror for a given day.
 * Always non-fatal: any error is logged and swallowed.
 * A missing GITHUB_MIRROR_TOKEN is silently skipped (mirror not configured).
 */
async function runMirror(date: string, dryRun: boolean): Promise<void> {
  if (!process.env.GITHUB_MIRROR_TOKEN) return;
  try {
    // Re-fetch after publish to capture any articles added by a second pipeline run.
    const fullEdition = await getEdition(date);
    if (!fullEdition) return;

    const allDates = await listPublishedDates();
    const mirrorArticles: MirrorArticle[] = fullEdition.articles.map((a) => ({
      slug: a.slug,
      title: a.title,
      summary: a.summary,
      category: a.category,
    }));
    const files = buildMirrorFiles(date, fullEdition.intro_md, mirrorArticles, allDates);

    if (dryRun) {
      console.log('[mirror] DRY_RUN — markdown generated, not pushed');
      for (const f of files) {
        console.log(`[mirror] ${f.path} (${f.content.length} chars)`);
        console.log(f.content.slice(0, 300) + (f.content.length > 300 ? '...' : ''));
      }
    } else {
      const sha = await pushMirrorFiles(files, `edition ${date}`);
      console.log(`[mirror] pushed — commit ${sha} ✓`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Non-fatal: site is published, mirror can be stale for one day.
    console.warn(`[mirror] push failed (non-fatal): ${msg}`);
  }
}

async function main(): Promise<void> {
  const edition = await getEdition(day!);

  if (!edition) {
    console.error(`[publish] No edition found for ${day}`);
    process.exit(1);
  }

  if (edition.status === 'published') {
    if (DRY_RUN) {
      // In DRY_RUN, skip all side-effects and only preview mirror output.
      console.log(`[publish] ${day} already published — DRY_RUN: mirror preview only`);
      await runMirror(day!, true);
      return;
    }
    console.warn(`[publish] ${day} is already published — nothing to do`);
    return;
  }

  console.log(
    `[publish] Publishing ${day} — ${edition.article_count} articles, ${edition.articles.length} loaded`,
  );

  await publishEdition(day!);
  console.log(`[publish] ${day} → published ✓`);

  // Emit edition_published to PostHog. shutdown() is required — posthog-node
  // buffers events and only flushes on explicit shutdown (PLAN_6 §6 rule 5).
  if (process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) {
    try {
      const ph = createPostHogServer();
      ph.capture({
        distinctId: 'system',
        event: EDITION_PUBLISHED,
        properties: { day, article_count: edition.article_count },
      });
      await ph.shutdown();
      console.log('[publish] edition_published → PostHog ✓');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Non-fatal: the edition is published even if PostHog capture fails.
      console.warn(`[publish] PostHog capture failed (non-fatal): ${msg}`);
    }
  }

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

  // Ping IndexNow so Bing/Yandex index the new articles immediately.
  // Fire-and-forget — non-fatal if missing or if the call fails.
  const indexNowKey = process.env.INDEXNOW_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wwwatch.dev';
  if (indexNowKey) {
    try {
      const urlList = edition.articles.map((a) => `${siteUrl}/journal/${day}/${a.slug}`);
      const res = await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          host: new URL(siteUrl).hostname,
          key: indexNowKey,
          keyLocation: `${siteUrl}/${indexNowKey}.txt`,
          urlList,
        }),
      });
      if (res.ok || res.status === 202) {
        console.log(`[publish] IndexNow: ${urlList.length} URL(s) submitted ✓`);
      } else {
        console.warn(`[publish] IndexNow returned HTTP ${res.status}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[publish] IndexNow failed (non-fatal): ${msg}`);
    }
  }

  // Push GitHub mirror. Runs last; failure is non-fatal.
  await runMirror(day!, DRY_RUN);

  console.log(`[publish] Done. Review at: /journal/${day}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[publish] fatal:', err);
    process.exit(1);
  });
