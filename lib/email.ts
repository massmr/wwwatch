import { createHmac } from 'node:crypto';

import { render } from '@react-email/render';
import { Resend } from 'resend';

import { WeeklyBrief } from '../emails/weekly-brief';

/**
 * Builds an opaque unsubscribe token that encodes the email + HMAC.
 * Format (base64url): "<email>:<hmac-sha256>"
 * The email is NOT in the URL query string — only the opaque token is.
 */
function buildUnsubscribeUrl(email: string): string {
  const siteUrl = process.env.SITE_URL ?? 'https://wwwatch.vercel.app';
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error('UNSUBSCRIBE_SECRET manquant');
  const hmac = createHmac('sha256', secret).update(email).digest('hex');
  const token = Buffer.from(`${email}:${hmac}`).toString('base64url');
  return `${siteUrl}/unsubscribe?token=${token}`;
}

export type SendResult = { sent: number; failed: number };

/** Sends the brief HTML email to each address sequentially. */
export async function sendBriefToList(
  emails: string[],
  markdown: string,
  subject: string
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY manquant');

  const from = process.env.EMAIL_FROM ?? 'onboarding@resend.dev';
  const replyTo = process.env.EMAIL_REPLY_TO;

  const resend = new Resend(apiKey);
  let sent = 0;
  let failed = 0;

  for (const to of emails) {
    try {
      // render() called per recipient to personalise the unsubscribe link.
      // WeeklyBrief() is called as a function (not JSX) because lib/email.ts
      // is a .ts file. Static email components with no hooks — safe pattern.
      const html = await render(
        WeeklyBrief({ markdown, unsubscribeUrl: buildUnsubscribeUrl(to), previewText: subject })
      );
      const { error } = await resend.emails.send({
        from,
        to,
        subject,
        html,
        ...(replyTo ? { replyTo } : {}),
      });
      if (error) {
        console.error(`[email] FAIL ${to}:`, error);
        failed++;
      } else {
        sent++;
      }
    } catch (err) {
      console.error(`[email] FAIL ${to}:`, err);
      failed++;
    }
    // Resend rate-limit à 10 req/s en free tier, on lisse à 8 par sécurité.
    await new Promise<void>((r) => setTimeout(r, 125));
  }

  return { sent, failed };
}
