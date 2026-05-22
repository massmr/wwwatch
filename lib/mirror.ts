/**
 * lib/mirror.ts — GitHub mirror generation and push (PLAN_8).
 *
 * Two responsibilities:
 *   1. Pure markdown rendering functions (renderLeaf, renderMonth, renderYear, renderRoot).
 *   2. pushMirrorFiles() — single-commit push via GitHub Git Data API.
 *
 * Called from scripts/publish.ts after a successful publication. Any failure
 * is non-fatal: the site is published regardless.
 */

import path from 'node:path';

// ── Constants ─────────────────────────────────────────────────────────────────

const SITE_URL = 'https://wwwatch.dev';

// Reused in every mirror doc. No em/en dashes (CONVENTIONS §ponctuation).
export const WWWATCH_INTRO = [
  '> **wwwatch**: daily AI intel for builders.',
  '> Five minutes. Sourced. No hype.',
  `> Full editions at [wwwatch.dev](${SITE_URL})`,
].join('\n');

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

function monthName(mm: string): string {
  return MONTHS[(parseInt(mm, 10) - 1) as number] ?? mm;
}

function fmtDate(date: string): string {
  const [y, m, d] = date.split('-') as [string, string, string];
  return `${monthName(m)} ${parseInt(d, 10)}, ${y}`;
}

// ── Relative link helper (§3) ─────────────────────────────────────────────────

/**
 * Returns the relative path from `from` to `to`, correct for GitHub markdown.
 * Uses path.relative so links work at any nesting depth.
 *
 * relLink('README.md', 'archive/2026/05/21.md')  => 'archive/2026/05/21.md'
 * relLink('archive/2026/05/21.md', 'README.md')  => '../../../README.md'
 * relLink('archive/2026/05/21.md', 'archive/2026/05.md') => '../05.md'
 */
export function relLink(from: string, to: string): string {
  return path.relative(path.dirname(from), to);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type MirrorArticle = {
  slug: string;
  title: string;
  summary: string;
  category: string;
};

export type MirrorFile = {
  path: string;
  content: string;
};

// ── Rendering (pure functions) ────────────────────────────────────────────────

/** Leaf doc for a single day: intro + article summaries + nav up. */
export function renderLeaf(
  fromPath: string,
  date: string,
  dayIntro: string,
  articles: MirrorArticle[],
): string {
  const [y, m] = date.split('-') as [string, string, string];
  const monthPath = `archive/${y}/${m}.md`;
  const rootPath = 'README.md';

  const lines: string[] = [
    WWWATCH_INTRO,
    '',
    '---',
    '',
    `## ${fmtDate(date)}`,
    '',
    dayIntro,
    '',
    `[View full edition on wwwatch.dev](${SITE_URL}/journal/${date})`,
    '',
    '---',
    '',
  ];

  for (const a of articles) {
    lines.push(
      `### [${a.category}] [${a.title}](${SITE_URL}/journal/${date}/${a.slug})`,
      '',
      a.summary,
      '',
    );
  }

  lines.push(
    '---',
    '',
    `[${monthName(m)} ${y}](${relLink(fromPath, monthPath)}) · [Home](${relLink(fromPath, rootPath)})`,
  );

  return lines.join('\n');
}

/** Month navigation doc: lists every day in the month with edition links. */
export function renderMonth(
  fromPath: string,
  year: string,
  month: string,
  dates: string[], // YYYY-MM-DD for this month, reverse chrono
): string {
  const yearPath = `archive/${year}.md`;
  const rootPath = 'README.md';

  const lines: string[] = [
    WWWATCH_INTRO,
    '',
    '---',
    '',
    `## ${monthName(month)} ${year}`,
    '',
  ];

  for (const d of dates) {
    const dd = d.split('-')[2] as string;
    const dayPath = `archive/${year}/${month}/${dd}.md`;
    lines.push(`- [${fmtDate(d)}](${relLink(fromPath, dayPath)})`);
  }

  lines.push(
    '',
    '---',
    '',
    `[${year}](${relLink(fromPath, yearPath)}) · [Home](${relLink(fromPath, rootPath)})`,
  );

  return lines.join('\n');
}

/** Year navigation doc: lists every month with editions. */
export function renderYear(
  fromPath: string,
  year: string,
  months: string[], // 'MM' strings with editions for this year, reverse chrono
): string {
  const rootPath = 'README.md';

  const lines: string[] = [
    WWWATCH_INTRO,
    '',
    '---',
    '',
    `## ${year}`,
    '',
  ];

  for (const m of months) {
    const monthPath = `archive/${year}/${m}.md`;
    lines.push(`- [${monthName(m)} ${year}](${relLink(fromPath, monthPath)})`);
  }

  lines.push(
    '',
    '---',
    '',
    `[Home](${relLink(fromPath, rootPath)})`,
  );

  return lines.join('\n');
}

/** Root README: today's full edition + navigation (month, year, archive). */
export function renderRoot(
  today: { date: string; intro: string; articles: MirrorArticle[] },
  allDates: string[], // all published dates, reverse chrono
): string {
  const fromPath = 'README.md';
  const [todayY, todayM] = today.date.split('-') as [string, string, string];

  // All days in current month
  const thisMonthDays = allDates.filter((d) => d.startsWith(`${todayY}-${todayM}`));

  // All months in current year with editions, excluding current month
  const thisYearMonths = [
    ...new Set(
      allDates
        .filter((d) => d.startsWith(todayY) && !d.startsWith(`${todayY}-${todayM}`))
        .map((d) => (d.split('-')[1] as string)),
    ),
  ];

  // All past years with editions
  const pastYears = [
    ...new Set(
      allDates
        .filter((d) => !d.startsWith(todayY))
        .map((d) => (d.split('-')[0] as string)),
    ),
  ];

  const lines: string[] = [
    '# wwwatch',
    '',
    WWWATCH_INTRO,
    '',
    '---',
    '',
    `## ${fmtDate(today.date)}`,
    '',
    today.intro,
    '',
    `[View full edition on wwwatch.dev](${SITE_URL}/journal/${today.date})`,
    '',
  ];

  for (const a of today.articles) {
    lines.push(
      `### [${a.category}] [${a.title}](${SITE_URL}/journal/${today.date}/${a.slug})`,
      '',
      a.summary,
      '',
    );
  }

  lines.push('---', '');

  if (thisMonthDays.length > 0) {
    lines.push(`## ${monthName(todayM)} ${todayY}`, '');
    for (const d of thisMonthDays) {
      const dd = d.split('-')[2] as string;
      lines.push(`- [${fmtDate(d)}](archive/${todayY}/${todayM}/${dd}.md)`);
    }
    lines.push('');
  }

  if (thisYearMonths.length > 0) {
    lines.push(`## ${todayY}`, '');
    for (const m of thisYearMonths) {
      lines.push(`- [${monthName(m)} ${todayY}](archive/${todayY}/${m}.md)`);
    }
    lines.push('');
  }

  if (pastYears.length > 0) {
    lines.push('## Archive', '');
    for (const y of pastYears) {
      lines.push(`- [${y}](archive/${y}.md)`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Builds the 4 mirror files to push for a given publication.
 * Returns MirrorFile[] — caller decides whether to push or just log (DRY_RUN).
 */
export function buildMirrorFiles(
  date: string,
  dayIntro: string,
  articles: MirrorArticle[],
  allDates: string[], // all published dates including today, reverse chrono
): MirrorFile[] {
  const [y, m, d] = date.split('-') as [string, string, string];

  const leafPath = `archive/${y}/${m}/${d}.md`;
  const monthPath = `archive/${y}/${m}.md`;
  const yearPath = `archive/${y}.md`;

  const monthDates = allDates.filter((dt) => dt.startsWith(`${y}-${m}`));
  const yearMonths = [
    ...new Set(allDates.filter((dt) => dt.startsWith(y)).map((dt) => dt.split('-')[1] as string)),
  ];

  return [
    {
      path: 'README.md',
      content: renderRoot({ date, intro: dayIntro, articles }, allDates),
    },
    {
      path: leafPath,
      content: renderLeaf(leafPath, date, dayIntro, articles),
    },
    {
      path: monthPath,
      content: renderMonth(monthPath, y, m, monthDates),
    },
    {
      path: yearPath,
      content: renderYear(yearPath, y, yearMonths),
    },
  ];
}

// ── GitHub Git Data API ───────────────────────────────────────────────────────

const GH_API = 'https://api.github.com';

async function ghPost(
  url: string,
  token: string,
  body: object,
): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '(no body)');
    throw new Error(`POST ${url} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

async function ghPatch(
  url: string,
  token: string,
  body: object,
): Promise<void> {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '(no body)');
    throw new Error(`PATCH ${url} → ${res.status}: ${text}`);
  }
}

/**
 * Pushes files to the mirror repo as a single commit via Git Data API.
 * Returns the new commit SHA.
 *
 * Handles both the initial push to an empty repo (no existing ref) and
 * subsequent daily pushes (updates the existing main branch).
 */
export async function pushMirrorFiles(
  files: MirrorFile[],
  commitMessage: string,
): Promise<string> {
  const token = process.env.GITHUB_MIRROR_TOKEN;
  const repoSlug = process.env.GITHUB_MIRROR_REPO;
  if (!token) throw new Error('GITHUB_MIRROR_TOKEN missing');
  if (!repoSlug) throw new Error('GITHUB_MIRROR_REPO missing');

  const base = `${GH_API}/repos/${repoSlug}`;

  // 1. Get current main ref (404 = empty repo, first push).
  let parentSha: string | null = null;
  let baseTreeSha: string | null = null;
  let isFirstPush = false;
  let refExists = false; // track whether main branch already exists

  const refRes = await fetch(`${base}/git/refs/heads/main`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (refRes.ok) {
    refExists = true;
    const refData = (await refRes.json()) as { object: { sha: string } };
    parentSha = refData.object.sha;
    // Get the tree SHA from the parent commit.
    const commitRes = await fetch(`${base}/git/commits/${parentSha}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    const commitData = (await commitRes.json()) as { tree: { sha: string } };
    baseTreeSha = commitData.tree.sha;
  } else if (refRes.status === 404 || refRes.status === 409) {
    // 404: branch doesn't exist. 409: repo completely empty (no git objects yet).
    // Git Data API (blobs/trees) requires at least one existing commit.
    // Use the Contents API to create the very first file, which initialises the repo.
    isFirstPush = true;
    const seedFile = files.find((f) => f.path === 'README.md') ?? files[0];
    if (!seedFile) throw new Error('No files to push');

    const seedRes = await fetch(`${base}/contents/${seedFile.path}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'init: create repository',
        content: Buffer.from(seedFile.content, 'utf-8').toString('base64'),
      }),
    });
    if (!seedRes.ok) {
      const text = await seedRes.text().catch(() => '');
      throw new Error(`Contents API init → ${seedRes.status}: ${text}`);
    }
    const seedData = (await seedRes.json()) as { commit: { sha: string; tree: { sha: string } } };
    parentSha = seedData.commit.sha;
    baseTreeSha = seedData.commit.tree.sha;
    refExists = true; // Contents API created the main branch as part of the seed commit.
    // Remove the seed file from the batch so it is updated (not re-created) by Git Data API.
    files = files.filter((f) => f.path !== seedFile.path);
    if (files.length === 0) return parentSha; // only one file total — done
  } else {
    const text = await refRes.text().catch(() => '');
    throw new Error(`GET refs/heads/main → ${refRes.status}: ${text}`);
  }

  // 2. Create blobs (one per file, base64-encoded).
  const treeEntries = await Promise.all(
    files.map(async (f) => {
      const blob = await ghPost(`${base}/git/blobs`, token, {
        content: Buffer.from(f.content, 'utf-8').toString('base64'),
        encoding: 'base64',
      });
      return {
        path: f.path,
        mode: '100644',
        type: 'blob',
        sha: blob['sha'] as string,
      };
    }),
  );

  // 3. Create tree (with base_tree for incremental updates).
  const treeBody: Record<string, unknown> = { tree: treeEntries };
  if (baseTreeSha) treeBody['base_tree'] = baseTreeSha;
  const tree = await ghPost(`${base}/git/trees`, token, treeBody);

  // 4. Create commit (no parents on first push).
  const commitBody: Record<string, unknown> = {
    message: commitMessage,
    tree: tree['sha'],
  };
  if (parentSha) commitBody['parents'] = [parentSha];
  const commit = await ghPost(`${base}/git/commits`, token, commitBody);
  const commitSha = commit['sha'] as string;

  // 5. Update or create the main ref.
  if (refExists) {
    await ghPatch(`${base}/git/refs/heads/main`, token, { sha: commitSha });
  } else {
    // Branch doesn't exist yet (non-empty repo, branch just not created).
    await ghPost(`${base}/git/refs`, token, {
      ref: 'refs/heads/main',
      sha: commitSha,
    });
  }

  return commitSha;
}
