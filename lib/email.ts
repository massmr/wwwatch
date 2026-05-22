import { createHmac } from 'node:crypto';

import {
  buildHead,
  render,
  segmentsToMjml,
  type Segment,
  type Theme,
  type WrapperFn,
  type WrapperMeta,
} from 'emailmd';
import { Resend } from 'resend';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wwwatch.dev';

// ── Brand theme ───────────────────────────────────────────────────────────────
// Mirrors tokens.scss: off-white bg, near-black fg, muted body, 4px radius.

const WWWATCH_THEME: Partial<Theme> = {
  backgroundColor: '#f5f5f4',
  contentColor:    '#ffffff',
  headingColor:    '#111111',
  bodyColor:       '#6b7280',
  brandColor:      '#111111',   // links
  buttonColor:     '#111111',
  buttonTextColor: '#ffffff',
  cardColor:       '#f5f5f4',
  borderRadius:    '4px',
  fontSize:        '16px',
  lineHeight:      '1.6',
  contentWidth:    '600px',
};

// ── Category accent palette (matches OG cards and PLAN_7 §1) ─────────────────

const CATEGORY_ACCENT: Record<string, string> = {
  coding_agent: '#4ADE80',
  framework:    '#22D3EE',
  infra_api:    '#2DD4BF',
  research:     '#818CF8',
  tool:         '#94A3B8',
  funding:      '#34D399',
  security:     '#FBBF24',
  eval:         '#60A5FA',
  ops:          '#FB923C',
};

// Muted light backgrounds that pair with each accent (readable in all clients).
const CATEGORY_CHIP_BG: Record<string, string> = {
  coding_agent: '#f0fdf4',
  framework:    '#f0f9ff',
  infra_api:    '#f0fdfa',
  research:     '#f5f3ff',
  tool:         '#f8fafc',
  funding:      '#ecfdf5',
  security:     '#fffbeb',
  eval:         '#eff6ff',
  ops:          '#fff7ed',
};

export function categoryAccent(cat: string): { color: string; bg: string } {
  return {
    color: CATEGORY_ACCENT[cat] ?? '#94A3B8',
    bg:    CATEGORY_CHIP_BG[cat] ?? '#f8fafc',
  };
}

// ── Custom wrapper: full-width dark masthead ──────────────────────────────────
// emailmd's :::header directive doesn't support a background-color on the
// outer mj-section (source confirmed). We use buildHead + segmentsToMjml to
// inject a full-width #0C0E12 band before the body content.

const wwwatchWrapper: WrapperFn = (
  segments: Segment[],
  theme: Theme,
  meta?: WrapperMeta,
) => {
  const head = buildHead(theme, meta?.preheader);
  const body = segmentsToMjml(segments, theme);

  const masthead = `
<mj-section background-color="#0C0E12" padding="20px 32px">
  <mj-column>
    <mj-text
      font-size="20px"
      font-weight="700"
      color="#ECECEC"
      letter-spacing="-0.02em"
      font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif"
      line-height="1"
    >wwwatch</mj-text>
  </mj-column>
</mj-section>`;

  return `<mjml>${head}<mj-body background-color="${theme.backgroundColor}">${masthead}${body}</mj-body></mjml>`;
};

// ── Unsubscribe URL ───────────────────────────────────────────────────────────

function buildUnsubscribeUrl(email: string): string {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error('UNSUBSCRIBE_SECRET missing');
  const hmac = createHmac('sha256', secret).update(email).digest('hex');
  const token = Buffer.from(`${email}:${hmac}`).toString('base64url');
  return `${SITE_URL}/unsubscribe?token=${token}`;
}

// ── Footer block (shared) ─────────────────────────────────────────────────────
// No em/en dashes (CONVENTIONS). Middle dot as brand separator.

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
  const lines = [
    '---',
    'preheader: "You\'re subscribed to wwwatch, the daily AI journal for builders."',
    '---',
    '',
    'You\'re in.',
    '',
    'Every morning, wwwatch surfaces what actually moved in AI the day before. The models,',
    'tools, and releases that change what you ship this week. Five minutes. Sourced. No hype.',
    '',
    'The daily journal is on the site. The weekly brief lands in your inbox every Monday.',
    '',
    `[Read today's journal](${SITE_URL}/today){button}`,
    '',
    footerBlock(unsubscribeUrl),
  ];
  return lines.join('\n');
}

export async function sendWelcomeEmail(to: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY missing');

  const from = process.env.RESEND_FROM_EMAIL ?? 'brief@wwwatch.dev';
  const resend = new Resend(apiKey);

  const markdown = buildWelcomeMarkdown(buildUnsubscribeUrl(to));
  const { html, text } = await render(markdown, {
    theme: WWWATCH_THEME,
    wrapper: wwwatchWrapper,
  });

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

export type SendResult = { sent: number; failed: number };

/** Sends the weekly brief to each address sequentially, per-recipient for the unsubscribe URL. */
export async function sendBriefToList(
  emails: string[],
  markdown: string,
  subject: string,
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY missing');

  const from = process.env.RESEND_FROM_EMAIL ?? 'brief@wwwatch.dev';
  const resend = new Resend(apiKey);
  let sent = 0;
  let failed = 0;

  for (const to of emails) {
    try {
      const fullMarkdown = buildNewsletterMarkdown(markdown, buildUnsubscribeUrl(to), subject);
      const { html, text } = await render(fullMarkdown, {
        theme: WWWATCH_THEME,
        wrapper: wwwatchWrapper,
      });

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

function buildNewsletterMarkdown(
  bodyMarkdown: string,
  unsubscribeUrl: string,
  subject: string,
): string {
  const lines = [
    '---',
    `preheader: "${subject}"`,
    '---',
    '',
    bodyMarkdown,
    '',
    `[Read the full journal](${SITE_URL}/journal){button}`,
    '',
    footerBlock(unsubscribeUrl),
  ];
  return lines.join('\n');
}
