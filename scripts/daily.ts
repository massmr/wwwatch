/**
 * scripts/daily.ts — Daily pipeline entrypoint.
 *
 * Six steps: collect → score → enrich → write → QA → store.
 *
 * DRY_RUN=1 runs the full pipeline including LLM calls but skips all DB writes.
 * This lets you review article quality before committing to the database.
 * See PLAN_3 §8 Phase 3 STOP condition.
 *
 * Usage:
 *   npm run daily        # full run
 *   npm run daily:dry    # DRY_RUN=1 — no DB writes, logs full article output
 */
import { collectAll } from '@/lib/collectors/index';
import { scoreItems } from '@/lib/scoring';
import { enrichItems } from '@/lib/enrich';
import { writeArticles } from '@/lib/writer';
import { checkArticles } from '@/lib/editor';
import {
  getRecentFingerprints,
  insertArticles,
  saveRawItems,
  upsertEdition,
} from '@/lib/db';

const DRY_RUN = process.env.DRY_RUN === '1';
// Allow overriding the day for testing: DAY=2026-05-20 npm run daily:dry
const TODAY = process.env.DAY ?? new Date().toISOString().slice(0, 10);

async function main(): Promise<void> {
  const startedAt = Date.now();
  console.log(`[daily] start — day=${TODAY} DRY_RUN=${DRY_RUN}`);

  // ─── Step 1: Collect ─────────────────────────────────────────────────────
  const rawItems = await collectAll();

  // ─── Step 2: Score + dedup ───────────────────────────────────────────────
  // In DRY_RUN, skip the DB fingerprint check to avoid requiring a live DB.
  const recentFingerprints = DRY_RUN ? [] : await getRecentFingerprints(3);
  const { top, all } = scoreItems(rawItems, recentFingerprints);

  if (!DRY_RUN) {
    await saveRawItems(all);
  }

  if (top.length === 0) {
    console.log('[daily] no items to write after dedup — exiting');
    return;
  }

  // ─── Step 3: Enrich (selective) ──────────────────────────────────────────
  const enriched = await enrichItems(top);

  // ─── Step 4: Write ───────────────────────────────────────────────────────
  const { articles, introMd, tokenUsage } = await writeArticles(enriched, TODAY);
  console.log(
    `[daily] writer: ${articles.length} articles, ` +
      `${tokenUsage.input}in/${tokenUsage.output}out tokens total`,
  );

  if (articles.length === 0) {
    console.error('[daily] writer produced no articles — aborting');
    return;
  }

  // ─── Step 5: QA ──────────────────────────────────────────────────────────
  const flags = checkArticles(articles, recentFingerprints);
  if (flags.length > 0) {
    console.warn(`[daily] editor: ${flags.length} article(s) flagged`);
    for (const f of flags) {
      console.warn(`  FLAG ${f.slug}: ${f.flags.join(', ')}`);
    }
  } else {
    console.log('[daily] editor: no flags');
  }

  // ─── DRY_RUN: print full output and exit ─────────────────────────────────
  if (DRY_RUN) {
    const sep = '─'.repeat(60);
    console.log(`\n${sep}\nDRY_RUN OUTPUT — ${TODAY}\n${sep}`);

    if (introMd) {
      console.log(`\nINTRO:\n${introMd}\n`);
    }

    for (const a of articles) {
      const flagEntry = flags.find((f) => f.slug === a.slug);
      const flagStr = flagEntry ? ` [FLAG: ${flagEntry.flags.join(', ')}]` : '';
      const wordCount = a.bodyMd.split(/\s+/).filter(Boolean).length;

      console.log(`\n${sep}`);
      console.log(`[${a.category.toUpperCase()}]${flagStr} ${a.title}`);
      console.log(`slug:    ${a.slug}`);
      console.log(`summary: ${a.summary}`);
      console.log(`words:   ${wordCount}`);
      console.log(`sources: ${a.sources.map((s) => s.url).join(', ')}`);
      console.log(`\n--- body_md ---\n${a.bodyMd}`);
    }

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(
      `\n${sep}\n[daily] DRY_RUN done — ${articles.length} articles in ${elapsed}s — no DB writes\n`,
    );
    return;
  }

  // ─── Step 6: Store ───────────────────────────────────────────────────────
  await upsertEdition({ day: TODAY, introMd, articleCount: articles.length });
  await insertArticles(articles);

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `[daily] done — ${articles.length} draft articles stored for ${TODAY} in ${elapsed}s`,
  );
  console.log(`[daily] review at: /journal/${TODAY} (after publish.ts runs)`);
}

main().catch((err) => {
  console.error('[daily] fatal:', err);
  process.exit(1);
});
