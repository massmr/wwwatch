import { createHmac, timingSafeEqual } from 'node:crypto';

import { deactivateSubscriber } from '@/lib/db';
import styles from './page.module.scss';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = {
  searchParams: Promise<{ email?: string; token?: string }>;
};

function isValidToken(email: string, token: string): boolean {
  const secret = process.env.UNSUBSCRIBE_SECRET ?? '';
  const expected = createHmac('sha256', secret).update(email).digest('hex');
  // Timing-safe comparison to prevent timing attacks.
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch {
    return false;
  }
}

export default async function UnsubscribePage({ searchParams }: Props) {
  const { email: rawEmail, token } = await searchParams;

  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';

  if (!EMAIL_RE.test(email) || typeof token !== 'string' || !isValidToken(email, token)) {
    return (
      <main className={styles.main}>
        <p className={styles.error}>Lien invalide ou expiré.</p>
      </main>
    );
  }

  try {
    await deactivateSubscriber(email);
  } catch (err) {
    console.error('[unsubscribe]', err);
    return (
      <main className={styles.main}>
        <p className={styles.error}>Erreur serveur, réessaie plus tard.</p>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Désinscription confirmée.</h1>
      <p className={styles.subtitle}>
        Tu ne recevras plus wwwatch. Bonne continuation.
      </p>
    </main>
  );
}
