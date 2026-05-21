/**
 * scripts/daily.ts — Daily pipeline entrypoint.
 *
 * Phase 2 stub: collect + log only. DRY_RUN exits after logging.
 * Phases 3-4 will add: score → enrich → write → QA → store.
 *
 * Usage:
 *   npm run daily        # full run (Phase 4+)
 *   npm run daily:dry    # DRY_RUN=1 — collect + log, no DB writes
 */
import { collectAll } from '@/lib/collectors/index';

const DRY_RUN = process.env.DRY_RUN === '1';

async function main(): Promise<void> {
  const startedAt = Date.now();
  console.log(`[daily] start — DRY_RUN=${DRY_RUN}`);

  // ─── Step 1: Collect ─────────────────────────────────────────────────────
  const rawItems = await collectAll();

  if (DRY_RUN) {
    console.log('\n[daily] DRY_RUN — collected items:');
    for (const item of rawItems) {
      const meta = [
        item.source.padEnd(20),
        item.upvotes != null ? `▲${item.upvotes}` : item.stars != null ? `★${item.stars}` : '   ',
        item.title.slice(0, 80),
      ].join('  ');
      console.log(`  ${meta}`);
    }
    console.log(`\n[daily] DRY_RUN done — ${rawItems.length} items, no DB writes`);
    return;
  }

  // ─── Steps 2-6: TODO in Phase 3 & 4 ────────────────────────────────────
  // TODO(maintainer, 2026-06-01): score → enrich → write → QA → store
  console.log('[daily] pipeline steps 2-6 not yet implemented (Phase 3 & 4)');

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`[daily] done in ${elapsed}s`);
}

main().catch((err) => {
  console.error('[daily] fatal:', err);
  process.exit(1);
});
