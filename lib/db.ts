import { neon } from '@neondatabase/serverless';

/** Returns a Neon SQL client (tagged template literals). */
export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL manquant');
  return neon(url);
}

/** Returns the list of active subscriber emails. */
export async function getActiveSubscribers(): Promise<string[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT email FROM public.subscribers WHERE status = 'active'
  `;
  // email is NOT NULL in schema — Neon rows are plain objects typed as Record<string,unknown>.
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
    console.error('[db] Impossible de logger le brief :', err);
  }
}
