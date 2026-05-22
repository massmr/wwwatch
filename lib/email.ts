import { createHmac } from 'node:crypto';

import { render } from 'emailmd';
import { Resend } from 'resend';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wwwatch.dev';

/**
 * Builds an opaque unsubscribe token that encodes the email + HMAC.
 * Format (base64url): "<email>:<hmac-sha256>"
 * The email is NOT in the URL query string — only the opaque token is.
 */
function buildUnsubscribeUrl(email: string): string {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error('UNSUBSCRIBE_SECRET missing');
  const hmac = createHmac('sha256', secret).update(email).digest('hex');
  const token = Buffer.from(`${email}:${hmac}`).toString('base64url');
  return `${SITE_URL}/unsubscribe?token=${token}`;
}

/**
 * Wraps the brief body markdown with a branded header and personalized footer.
 * Replaces the former Header/Footer JSX components.
 * No em/en dashes (CONVENTIONS §ponctuation).
 */
function wrapWithTemplate(bodyMarkdown: string, unsubscribeUrl: string): string {
  return [
    '# wwwatch',
    '',
    'AI intel for builders. Five minutes. Sourced. No hype.',
    '',
    '---',
    '',
    bodyMarkdown,
    '',
    '---',
    '',
    `wwwatch weekly brief. [wwwatch.dev](${SITE_URL}) · [Unsubscribe](${unsubscribeUrl})`,
  ].join('\n');
}

export type SendResult = { sent: number; failed: number };

/** Sends the brief to each address sequentially, rendering per recipient for the unsubscribe URL. */
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
      const fullMarkdown = wrapWithTemplate(markdown, buildUnsubscribeUrl(to));
      const { html, text } = await render(fullMarkdown);

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
    // Resend rate-limit: 10 req/s on free tier — throttle to 8/s for safety.
    await new Promise<void>((r) => setTimeout(r, 125));
  }

  return { sent, failed };
}
