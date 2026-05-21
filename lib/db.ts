import { neon } from '@neondatabase/serverless';

import type { RawItem } from './collectors/types';
// Re-export so callers that only touch the DB layer don't need a second import.
export type { RawItem } from './collectors/types';

/** Returns a Neon SQL client (tagged template literals). */
export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');
  return neon(url);
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type EditionStatus = 'draft' | 'published';

export type Edition = {
  day: string; // YYYY-MM-DD
  lang: string;
  intro_md: string;
  status: EditionStatus;
  article_count: number;
  created_at: string;
  published_at: string | null;
};

/** Closed set from CONVENTIONS §Modèle de données pipeline règle 5. */
export type ArticleCategory =
  | 'coding_agent'
  | 'framework'
  | 'infra_api'
  | 'research'
  | 'tool'
  | 'funding'
  | 'security'
  | 'eval'
  | 'ops';

export type ArticleSource = {
  url: string;
  source: string;
  title: string;
};

export type Article = {
  id: string;
  day: string; // YYYY-MM-DD
  lang: string;
  slug: string;
  title: string;
  category: ArticleCategory;
  summary: string;
  body_md: string;
  sources: ArticleSource[];
  fingerprint: string;
  score: number;
  status: EditionStatus;
  created_at: string;
};

/** Input for inserting a new article (id and timestamps are DB-generated). */
export type NewArticle = {
  day: string;
  lang?: string; // defaults to 'en' at DB level; set explicitly for future multilingual support
  slug: string;
  title: string;
  category: ArticleCategory;
  summary: string;
  bodyMd: string;
  sources: ArticleSource[];
  fingerprint: string;
  score: number;
};

// ─── Row mappers ─────────────────────────────────────────────────────────────
//
// Neon tagged templates return Record<string,unknown> rows — the SDK has no
// per-query generics (intentional; see @neondatabase/serverless README).
// All casts below are safe as long as the DB schema in neon/0002_pipeline.sql
// is the authoritative source and is only modified via versioned migrations.
// The `sources` field is jsonb — Neon deserialises it to a JS object automatically.
//
// NOTE: PostgreSQL `date` columns are returned as JavaScript Date objects by the
// Neon HTTP driver. toDateString() normalises them to YYYY-MM-DD strings so they
// are safe to use in URLs and comparisons.

function toDateString(v: unknown): string {
  if (v instanceof Date) {
    // Neon creates the JS Date at LOCAL midnight for PostgreSQL `date` columns
    // (e.g. "Thu May 21 2026 00:00:00 GMT+0200"). toISOString() would give the
    // UTC equivalent ("2026-05-20T22:00:00Z") and slice off the wrong day.
    // Local getters return the calendar date the DB actually stored.
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  // Handles ISO strings like "2026-05-21T00:00:00.000Z".
  if (typeof v === 'string') return v.slice(0, 10);
  return String(v);
}

function toEdition(r: Record<string, unknown>): Edition {
  return {
    day: toDateString(r['day']),
    lang: r['lang'] as string,
    intro_md: r['intro_md'] as string,
    status: r['status'] as EditionStatus,
    article_count: r['article_count'] as number,
    created_at: r['created_at'] as string,
    published_at: (r['published_at'] as string | null) ?? null,
  };
}

function toArticle(r: Record<string, unknown>): Article {
  return {
    id: r['id'] as string,
    day: toDateString(r['day']),
    lang: r['lang'] as string,
    slug: r['slug'] as string,
    title: r['title'] as string,
    category: r['category'] as ArticleCategory,
    summary: r['summary'] as string,
    body_md: r['body_md'] as string,
    // Neon returns jsonb columns as parsed JS values — no JSON.parse needed.
    sources: r['sources'] as ArticleSource[],
    fingerprint: r['fingerprint'] as string,
    score: r['score'] as number,
    status: r['status'] as EditionStatus,
    created_at: r['created_at'] as string,
  };
}

// ─── Subscriber functions (pre-existing) ─────────────────────────────────────

/** Returns all active subscriber emails. */
export async function getActiveSubscribers(): Promise<string[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT email FROM public.subscribers WHERE status = 'active'
  `;
  // email is NOT NULL in schema — cast is safe.
  return rows.map((r) => r['email'] as string);
}

/** Inserts or reactivates a subscriber. */
export async function upsertSubscriber(email: string): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO public.subscribers (email, status, source)
    VALUES (${email}, 'active', 'landing')
    ON CONFLICT (email) DO UPDATE SET status = 'active'
  `;
}

/** Sets a subscriber's status to 'unsubscribed'. No-ops if email not found. */
export async function deactivateSubscriber(email: string): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE public.subscribers
    SET status = 'unsubscribed', unsubscribed_at = now()
    WHERE email = ${email}
  `;
}

type LogBriefOpts = {
  subject: string;
  markdown: string;
  recipientCount: number;
};

/** Logs a sent brief to the DB. Swallows errors to avoid blocking the send. */
export async function logBrief(opts: LogBriefOpts): Promise<void> {
  const sql = getSql();
  try {
    await sql`
      INSERT INTO public.briefs (subject, markdown, recipient_count)
      VALUES (${opts.subject}, ${opts.markdown}, ${opts.recipientCount})
    `;
  } catch (err) {
    console.error('[db] logBrief failed:', err);
  }
}

// ─── Pipeline functions ───────────────────────────────────────────────────────

/**
 * Upserts an edition row for the given day.
 * On conflict, updates intro_md and article_count only — status is never
 * overwritten here (use publishEdition for status transitions).
 */
export async function upsertEdition(opts: {
  day: string;
  introMd: string;
  articleCount: number;
}): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO editions (day, intro_md, article_count)
    VALUES (${opts.day}, ${opts.introMd}, ${opts.articleCount})
    ON CONFLICT (day) DO UPDATE
      SET intro_md      = ${opts.introMd},
          article_count = ${opts.articleCount}
  `;
}

/**
 * Inserts articles for an edition. Idempotent: (day, slug) conflicts are
 * silently skipped, so daily.ts can be re-run safely.
 */
export async function insertArticles(articles: NewArticle[]): Promise<void> {
  const sql = getSql();
  for (const a of articles) {
    await sql`
      INSERT INTO articles
        (day, lang, slug, title, category, summary, body_md, sources, fingerprint, score)
      VALUES (
        ${a.day},
        ${a.lang ?? 'en'},
        ${a.slug},
        ${a.title},
        ${a.category},
        ${a.summary},
        ${a.bodyMd},
        ${JSON.stringify(a.sources)}::jsonb,
        ${a.fingerprint},
        ${a.score}
      )
      ON CONFLICT (day, slug) DO NOTHING
    `;
  }
}

/**
 * Returns an edition with its articles, or null if not found.
 * Works for both draft and published editions (caller checks status).
 */
export async function getEdition(
  day: string
): Promise<(Edition & { articles: Article[] }) | null> {
  const sql = getSql();
  const [editions, articles] = await Promise.all([
    sql`SELECT * FROM editions WHERE day = ${day} LIMIT 1`,
    sql`SELECT * FROM articles WHERE day = ${day} ORDER BY score DESC`,
  ]);
  if (editions.length === 0) return null;
  return {
    ...toEdition(editions[0] as Record<string, unknown>),
    articles: articles.map((r) => toArticle(r as Record<string, unknown>)),
  };
}

/** Returns a single article by day + slug, or null if not found. */
export async function getArticle(day: string, slug: string): Promise<Article | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM articles WHERE day = ${day} AND slug = ${slug} LIMIT 1
  `;
  if (rows.length === 0) return null;
  return toArticle(rows[0] as Record<string, unknown>);
}

/** Returns all published editions in reverse-chronological order (no articles). */
export async function listPublishedEditions(): Promise<Edition[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM editions WHERE status = 'published' ORDER BY day DESC
  `;
  return rows.map((r) => toEdition(r as Record<string, unknown>));
}

/** Returns the most recent published edition, or null. Used for "Today" nav. */
export async function getLatestPublishedEdition(): Promise<Edition | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM editions WHERE status = 'published' ORDER BY day DESC LIMIT 1
  `;
  if (rows.length === 0) return null;
  return toEdition(rows[0] as Record<string, unknown>);
}

/**
 * Publishes an edition: sets status='published' and published_at=now().
 * No-ops if already published. Used by scripts/publish.ts.
 */
export async function publishEdition(day: string): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE editions
    SET status = 'published', published_at = now()
    WHERE day = ${day} AND status = 'draft'
  `;
}

/**
 * Returns published articles from the 7-day window ending on (and including)
 * `day`. Used by scripts/weekly.ts to compile the weekly brief.
 */
export async function getArticlesForWeek(day: string): Promise<Article[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT a.*
    FROM articles a
    JOIN editions e ON e.day = a.day
    WHERE e.status = 'published'
      AND a.day <= ${day}::date
      AND a.day >  (${day}::date - INTERVAL '7 days')
    ORDER BY a.score DESC
  `;
  return rows.map((r) => toArticle(r as Record<string, unknown>));
}

/**
 * Bulk-upserts raw collected items. On conflict on `id`, the existing row is
 * left unchanged — the pipeline can be re-run without duplicating items.
 */
export async function saveRawItems(items: RawItem[]): Promise<void> {
  const sql = getSql();
  for (const item of items) {
    await sql`
      INSERT INTO raw_items
        (id, source, title, url, description, published_at,
         upvotes, stars, comments, score, fingerprint)
      VALUES (
        ${item.id},
        ${item.source},
        ${item.title},
        ${item.url},
        ${item.description ?? null},
        ${item.published_at},
        ${item.upvotes ?? null},
        ${item.stars ?? null},
        ${item.comments ?? null},
        ${item.score ?? null},
        ${item.fingerprint}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }
}

/**
 * Returns the fingerprints of all articles stored within the last `days` days.
 * Used by the dedup check in scoring.ts to avoid re-writing the same story.
 */
export async function getRecentFingerprints(days: number): Promise<string[]> {
  const sql = getSql();
  const rows = await sql`
    -- days is a typed number, not from user input — SQL parameterisation is safe.
    SELECT DISTINCT fingerprint FROM articles
    WHERE created_at > now() - (${days} || ' days')::interval
  `;
  return rows.map((r) => r['fingerprint'] as string);
}
