import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { generateBriefMarkdown } from '@/lib/research';
import { getActiveSubscribers, logBrief } from '@/lib/db';
import { sendBriefToList } from '@/lib/email';

async function main(): Promise<void> {
  const now = new Date();
  const isDryRun = process.env.DRY_RUN === '1';

  // Dry run uses 3 searches: enough margin to survive a single detection timeout
  // while keeping cost low (~$0.20 vs ~$0.60 for prod). 1 was too tight — if the
  // only allowed search timed out, the model reported the service as "down".
  const markdown = await generateBriefMarkdown(isDryRun ? 3 : 5);

  // Save to <cwd>/out/YYYY-MM-DD.md — explicit cwd avoids issues in CI.
  const outDir = join(process.cwd(), 'out');
  mkdirSync(outDir, { recursive: true });
  const filename = join(outDir, `${now.toISOString().slice(0, 10)}.md`);
  writeFileSync(filename, markdown, 'utf-8');
  console.log(`[brief] Sauvegardé dans ${filename}`);

  // Build email subject: "wwwatch — semaine du 20 mai"
  const subject = `wwwatch — semaine du ${now.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
  })}`;

  // Determine recipients
  let recipients: string[];
  if (isDryRun) {
    const dryRunEmail = process.env.DRY_RUN_EMAIL;
    if (!dryRunEmail) throw new Error('DRY_RUN_EMAIL manquant');
    recipients = [dryRunEmail];
    // Truncate email to avoid logging PII.
    const masked = dryRunEmail.replace(/(?<=^.{3}).*(?=@)/, '***');
    console.log(`[brief] Dry run → envoi à ${masked}`);
  } else {
    recipients = await getActiveSubscribers();
    console.log(`[brief] ${recipients.length} abonné(s) actif(s)`);
  }

  // Send emails
  const result = await sendBriefToList(recipients, markdown, subject);
  console.log(`[brief] Envoyé: ${result.sent}, échoué: ${result.failed}`);

  // Log to DB (skipped in dry run)
  if (!isDryRun) {
    await logBrief({ subject, markdown, recipientCount: result.sent });
    console.log('[brief] Brief loggué en DB');
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('[brief] Erreur fatale:', msg);
  process.exit(1);
});
