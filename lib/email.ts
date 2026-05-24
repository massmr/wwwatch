import { createHmac } from 'node:crypto';

import { render, type Theme } from 'emailmd';
import { Resend } from 'resend';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wwwatch.dev';

// ── Brand theme — extracted from tokens.scss ──────────────────────────────────
// #fafaf9 bg / #fff content / #111 headings / #6b7280 muted / #0b62d6 links
// Border: #e5e5e5 / radius: 4-6px / mono: ui-monospace / sans: system stack

const WWWATCH_THEME: Partial<Theme> = {
  backgroundColor:  '#fafaf9',
  contentColor:     '#ffffff',
  headingColor:     '#111111',
  bodyColor:        '#6b7280',
  brandColor:       '#0b62d6',   // links — matches --color-accent
  buttonColor:      '#111111',
  buttonTextColor:  '#ffffff',
  cardColor:        '#f5f5f4',   // matches --color-border / --color-bg area
  borderRadius:     '6px',
  fontFamily:       "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif",
  fontSize:         '16px',
  lineHeight:       '1.6',
  contentWidth:     '600px',
};

// ── Unsubscribe URL ───────────────────────────────────────────────────────────

function buildUnsubscribeUrl(email: string): string {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error('UNSUBSCRIBE_SECRET missing');
  const hmac = createHmac('sha256', secret).update(email).digest('hex');
  const token = Buffer.from(`${email}:${hmac}`).toString('base64url');
  return `${SITE_URL}/unsubscribe?token=${token}`;
}

// ── Shared footer block ───────────────────────────────────────────────────────
// Mirrors the site footer copy exactly. Middle dot as separator (no dashes).

function footerBlock(unsubscribeUrl: string): string {
  return [
    '::: footer',
    'wwwatch · Built by builders, for builders. No ads, no clickbait, no sponsored picks in the feed.',
    '',
    `[Unsubscribe](${unsubscribeUrl})`,
    ':::',
  ].join('\n');
}

// ── EMAIL 1: Welcome ──────────────────────────────────────────────────────────

function buildWelcomeMarkdown(unsubscribeUrl: string): string {
  return [
    '---',
    `preheader: "You're subscribed to wwwatch, the daily AI journal for builders."`,
    '---',
    '',
    '**wwwatch**',
    '',
    '---',
    '',
    "You're in.",
    '',
    'Every morning, wwwatch surfaces what actually moved in AI the day before. The models,',
    'tools, and releases that change what you ship this week. Five minutes. Sourced. No hype.',
    '',
    'The daily journal is on the site. The weekly brief lands in your inbox every Monday.',
    '',
    `[Read today's journal](${SITE_URL}/today){button}`,
    '',
    footerBlock(unsubscribeUrl),
  ].join('\n');
}

export async function sendWelcomeEmail(to: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY missing');

  const fromEmail = process.env.RESEND_FROM_WELCOME ?? 'hello@wwwatch.dev';
  // Display name for the From header: Gmail and most clients show this
  // instead of deriving from the local-part. Resend passes it through verbatim.
  const from = `Massimo wwwatch <${fromEmail}>`;
  const resend = new Resend(apiKey);

  const markdown = buildWelcomeMarkdown(buildUnsubscribeUrl(to));
  const { html, text } = await render(markdown, { theme: WWWATCH_THEME });

  const { error } = await resend.emails.send({
    from,
    to,
    subject: 'Welcome to wwwatch',
    html,
    text,
  });
  if (error) throw new Error(`[email] welcome send failed: ${JSON.stringify(error)}`);
}

// ── EMAIL 2: Weekly brief ─────────────────────────────────────────────────────

/**
 * Preheader text shown next to the subject in Gmail/Apple Mail inbox previews.
 * Strips newlines, escapes embedded double quotes (YAML-frontmatter safe),
 * and truncates to ~140 chars so the preview isn't cut mid-thought.
 */
function buildPreheader(intro: string | undefined, fallback: string): string {
  const raw = intro?.trim() || fallback;
  const flat = raw.replace(/\s+/g, ' ');
  const trimmed = flat.length > 140 ? flat.slice(0, 137).trimEnd() + '...' : flat;
  return trimmed.replace(/"/g, '\\"');
}

function buildNewsletterMarkdown(
  bodyMarkdown: string,
  unsubscribeUrl: string,
  subject: string,
  dateRange: string,
  intro?: string,
): string {
  // Editorial byline header: avatar on the left, name + retro date on the right.
  //
  // Two-cell <table> inside an mj-text segment — the bulletproof email layout
  // for horizontal arrangement (float-based layouts misalign in Outlook and
  // some mobile clients). emailmd passes raw HTML through mj-text verbatim.
  // valign="top" + table-cell padding keeps the text aligned to the top of
  // the avatar.
  const bylineHeader = [
    '<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">',
    '<tr>',
    `<td valign="top" width="48"><img src="${SITE_URL}/massimo.png" alt="Massimo Marcellin" width="48" height="48" style="display:block;border-radius:50%;"></td>`,
    '<td valign="top" style="padding-left:12px;font-size:14px;line-height:1.4;">',
    '<strong>Massimo Marcellin</strong><br>',
    `Retro ${dateRange}`,
    '</td>',
    '</tr>',
    '</table>',
  ].join('\n');

  const parts = [
    '---',
    // Preheader = inbox preview text. Use the LLM intro if available so Gmail
    // doesn't echo the subject twice; fall back to the subject only when the
    // intro generation failed (e.g. ANTHROPIC_API_KEY missing).
    `preheader: "${buildPreheader(intro, subject)}"`,
    '---',
    '',
    '**wwwatch**',
    '',
    '---',
    '',
    bylineHeader,
    '',
    '---',
    '',
  ];

  if (intro) {
    parts.push(intro, '', '---', '');
  }

  parts.push(
    bodyMarkdown,
    '',
    `[Read the full journal](${SITE_URL}/journal){button}`,
    '',
    footerBlock(unsubscribeUrl),
  );

  return parts.join('\n');
}

export type SendResult = { sent: number; failed: number };

/** Sends the weekly brief to each address sequentially, per-recipient for the unsubscribe URL. */
export async function sendBriefToList(
  emails: string[],
  markdown: string,
  subject: string,
  dateRange: string,
  intro?: string,
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY missing');

  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'massimo@wwwatch.dev';
  // Display name for the From header (see sendWelcomeEmail above).
  const from = `Massimo wwwatch <${fromEmail}>`;
  const resend = new Resend(apiKey);
  let sent = 0;
  let failed = 0;

  for (const to of emails) {
    try {
      const fullMarkdown = buildNewsletterMarkdown(markdown, buildUnsubscribeUrl(to), subject, dateRange, intro);
      const { html, text } = await render(fullMarkdown, { theme: WWWATCH_THEME });

      const { error } = await resend.emails.send({ from, to, subject, html, text });
      if (error) {
        console.error(`[email] FAIL ${to.slice(0, 4)}***:`, error);
        failed++;
      } else {
        sent++;
      }
    } catch (err) {
      console.error(`[email] FAIL ${to.slice(0, 4)}***:`, err);
      failed++;
    }
    // Resend rate-limit: 10 req/s free tier — throttle to 8/s for safety.
    await new Promise<void>((r) => setTimeout(r, 125));
  }

  return { sent, failed };
}

// Export for weekly.ts (category label, no colour — site uses muted mono only)
export function categoryLabel(cat: string, labels: Record<string, string>): string {
  return (labels[cat] ?? cat).toUpperCase();
}
