/**
 * scripts/weekly.ts — Weekly brief pipeline.
 *
 * Runs every Monday at 07:00 UTC (see .github/workflows/weekly.yml).
 * Rescores the last 7 days of published articles, picks the top 5-8,
 * composes a brief from their summaries (zero LLM cost), sends to all
 * active subscribers, and logs the send to the briefs table.
 *
 * Usage:
 *   npm run weekly        # full send
 *   npm run weekly:dry    # DRY_RUN=1 — logs output, no email sent
 *   DAY=2026-05-21 npm run weekly:dry  # override date for testing
 */
import { getActiveSubscribers, getArticlesForWeek, logBrief } from '@/lib/db';
import { categoryAccent, sendBriefToList } from '@/lib/email';
import { formatDay } from '@/lib/format';
import type { Article } from '@/lib/db';

const DRY_RUN = process.env.DRY_RUN === '1';
const TODAY = process.env.DAY ?? new Date().toISOString().slice(0, 10);
// TEST_EMAIL=you@example.com sends to a single address instead of the full list.
// Skips the briefs log so it doesn't pollute the audit trail.
const TEST_EMAIL = process.env.TEST_EMAIL;

// Top N articles to include in the weekly brief.
const TOP_N = 7;

// Human-readable labels for article categories.
const CATEGORY_LABELS: Record<string, string> = {
  coding_agent: 'Coding agents',
  framework: 'Frameworks',
  infra_api: 'Infra & APIs',
  research: 'Research',
  tool: 'Tools',
  funding: 'Funding',
  security: 'Security',
  eval: 'Evals',
  ops: 'Ops',
};

function dateRangeLabel(endDay: string): string {
  const end = new Date(`${endDay}T00:00:00Z`);
  const start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
  const startStr = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}-${String(start.getUTCDate()).padStart(2, '0')}`;
  return `${formatDay(startStr)} to ${formatDay(endDay)}`;
}

function composeBrief(articles: Article[], siteUrl: string): string {
  const lines: string[] = [];

  for (const a of articles) {
    const label = CATEGORY_LABELS[a.category] ?? a.category;
    const articleUrl = `${siteUrl}/journal/${a.day}/${a.slug}`;
    const { color, bg } = categoryAccent(a.category);

    // Category chip: monospace label with accent colour, light matching bg.
    lines.push(`::: callout compact color=${color} bg=${bg} border-radius=4px`);
    lines.push(`\`${label.toUpperCase()}\``);
    lines.push(':::');
    lines.push('');
    lines.push(`**[${a.title}](${articleUrl})**`);
    lines.push('');
    lines.push(a.summary);
    lines.push('');
    lines.push(`[Read](${articleUrl}){button}`);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wwwatch.dev';
  console.log(`[weekly] start — day=${TODAY} DRY_RUN=${DRY_RUN}`);

  // ─── 1. Fetch published articles from the last 7 days ────────────────────
  const allArticles = await getArticlesForWeek(TODAY);
  if (allArticles.length === 0) {
    console.log('[weekly] no published articles in the last 7 days — nothing to send');
    return;
  }

  // ─── 2. Pick top N by score ───────────────────────────────────────────────
  const top = allArticles.slice(0, TOP_N);
  console.log(
    `[weekly] ${allArticles.length} articles available, selecting top ${top.length}`,
  );
  top.forEach((a, i) => {
    console.log(`  #${i + 1} [${a.category}] score=${a.score} "${a.title.slice(0, 60)}"`);
  });

  // ─── 3. Compose brief from summaries (zero LLM cost) ─────────────────────
  const dateRange = dateRangeLabel(TODAY);
  const markdown = composeBrief(top, siteUrl);
  const subject = `wwwatch: Week of ${dateRange}`;
  console.log(`[weekly] subject: "${subject}"`);

  if (DRY_RUN) {
    console.log('\n─── DRY_RUN OUTPUT ───────────────────────────────────────────\n');
    console.log(markdown);
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`\n[weekly] DRY_RUN done in ${elapsed}s — no emails sent`);
    return;
  }

  // ─── 4. Fetch subscribers + send ─────────────────────────────────────────
  const subscribers = TEST_EMAIL
    ? [TEST_EMAIL]
    : await getActiveSubscribers();

  if (subscribers.length === 0) {
    console.log('[weekly] no active subscribers — nothing to send');
    return;
  }

  if (TEST_EMAIL) {
    console.log(`[weekly] TEST_EMAIL mode — sending to ${TEST_EMAIL} only`);
  } else {
    console.log(`[weekly] sending to ${subscribers.length} subscriber(s)...`);
  }

  const { sent, failed } = await sendBriefToList(subscribers, markdown, subject);
  console.log(`[weekly] sent=${sent} failed=${failed}`);

  // ─── 5. Log to briefs table (skipped in TEST_EMAIL mode) ─────────────────
  if (TEST_EMAIL) {
    console.log('[weekly] TEST_EMAIL mode — skipping briefs log');
  } else if (sent > 0) {
    await logBrief({ subject, markdown, recipientCount: sent });
    console.log('[weekly] logged to briefs table');
  } else {
    console.warn('[weekly] sent=0 — skipping logBrief to avoid misleading audit entry');
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`[weekly] done in ${elapsed}s`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[weekly] fatal:', err);
    process.exit(1);
  });
