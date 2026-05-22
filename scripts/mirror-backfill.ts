/**
 * scripts/mirror-backfill.ts — Backfill the GitHub mirror with all past editions.
 *
 * Fetches every published edition from the DB, generates the full mirror
 * arborescence (all leaf files + all navigation docs + README), and pushes
 * everything in a single commit to the mirror repo.
 *
 * Usage:
 *   npm run mirror:backfill          # real push
 *   DRY_RUN=1 npm run mirror:backfill  # preview markdown, no push
 *
 * Requires GITHUB_MIRROR_TOKEN and GITHUB_MIRROR_REPO in env.
 */

import {
  buildMirrorFiles,
  pushMirrorFiles,
  renderLeaf,
  renderMonth,
  renderRoot,
  renderYear,
  type MirrorArticle,
  type MirrorFile,
} from '@/lib/mirror';
import { getEdition, listPublishedDates } from '@/lib/db';

const DRY_RUN = process.env.DRY_RUN === '1';

async function main(): Promise<void> {
  if (!process.env.GITHUB_MIRROR_TOKEN) {
    console.error('[backfill] GITHUB_MIRROR_TOKEN missing — set it in .env.local');
    process.exit(1);
  }

  const allDates = await listPublishedDates(); // reverse-chrono, e.g. ['2026-05-22', '2026-05-21']
  if (allDates.length === 0) {
    console.log('[backfill] No published editions found — nothing to do');
    return;
  }

  console.log(`[backfill] ${allDates.length} edition(s) to backfill: ${allDates.join(', ')}`);

  // ── Fetch all editions with articles ────────────────────────────────────────
  const editions: Array<{
    date: string;
    intro: string;
    articles: MirrorArticle[];
  }> = [];

  for (const date of allDates) {
    const edition = await getEdition(date);
    if (!edition) {
      console.warn(`[backfill] Edition not found for ${date} — skipping`);
      continue;
    }
    editions.push({
      date,
      intro: edition.intro_md ?? '',
      articles: edition.articles.map((a) => ({
        slug: a.slug,
        title: a.title,
        summary: a.summary,
        category: a.category,
      })),
    });
  }

  // ── Build all mirror files ──────────────────────────────────────────────────
  const files: MirrorFile[] = [];
  const seen = new Set<string>(); // deduplicate nav docs

  // Helper to add a file only once (nav docs are regenerated per day but should
  // be pushed only once — the last version wins since we process reverse-chrono).
  function addFile(f: MirrorFile): void {
    if (!seen.has(f.path)) {
      seen.add(f.path);
      files.push(f);
    }
  }

  // Leaf files for every day + their ancestor nav docs.
  for (const ed of editions) {
    const dayFiles = buildMirrorFiles(ed.date, ed.intro, ed.articles, allDates);
    for (const f of dayFiles) {
      // README is the root; add last (most-recent edition wins — already first in reverse-chrono).
      if (f.path !== 'README.md') addFile(f);
    }
  }

  // README: built from the most recent edition (first in reverse-chrono list).
  const latest = editions[0];
  if (latest) {
    files.push({
      path: 'README.md',
      content: renderRoot(
        { date: latest.date, intro: latest.intro, articles: latest.articles },
        allDates,
      ),
    });
  }

  console.log(`[backfill] ${files.length} file(s) to push:`);
  for (const f of files) {
    console.log(`  ${f.path} (${f.content.length} chars)`);
  }

  if (DRY_RUN) {
    console.log('\n[backfill] DRY_RUN — not pushing. First file preview:');
    const first = files[0];
    if (first) console.log(first.content.slice(0, 500));
    return;
  }

  const sha = await pushMirrorFiles(files, `backfill: ${allDates.length} edition(s) through ${allDates[0]}`);
  console.log(`[backfill] pushed — commit ${sha} ✓`);
  console.log(`[backfill] Mirror: https://github.com/${process.env.GITHUB_MIRROR_REPO}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[backfill] fatal:', err);
    process.exit(1);
  });
