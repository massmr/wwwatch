import { Resend } from 'resend';
import { marked } from 'marked';

// Mirror of app/_styles/tokens.scss — CSS custom properties cannot be used in email HTML.
const C_FG = '#111';         // --color-fg
const C_ACCENT = '#0b62d6';  // --color-accent
const C_BORDER = '#e5e5e5';  // --color-border
const C_QUOTE = '#333';      // blockquote body text
const C_HR = '#eee';         // hr and footer border
const C_CODE_BG = '#f4f4f4'; // inline code background
const C_FOOTER = '#888';     // footer text

async function renderHtml(markdown: string, subject: string): Promise<string> {
  const body = await marked.parse(markdown, { gfm: true });
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>${subject}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
       max-width:600px;margin:0 auto;padding:24px;color:${C_FG};line-height:1.55}
  h2{margin-top:32px;font-size:18px;letter-spacing:-0.01em}
  a{color:${C_ACCENT}}
  blockquote{border-left:3px solid ${C_BORDER};margin:8px 0;
             padding:4px 0 4px 12px;color:${C_QUOTE};font-size:14px}
  hr{border:none;border-top:1px solid ${C_HR};margin:28px 0}
  code{background:${C_CODE_BG};padding:1px 5px;border-radius:3px;font-size:13px}
  .footer{margin-top:40px;padding-top:20px;border-top:1px solid ${C_HR};
          color:${C_FOOTER};font-size:12px}
</style></head><body>
${body}
<div class="footer">wwwatch — veille IA hebdo pour product engineers.<br>
Pour te désinscrire, réponds "stop".</div>
</body></html>`;
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
  const html = await renderHtml(markdown, subject);

  let sent = 0;
  let failed = 0;

  for (const to of emails) {
    try {
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
