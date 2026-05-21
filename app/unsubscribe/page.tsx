import { createHmac, timingSafeEqual } from 'node:crypto';

import { deactivateSubscriber } from '@/lib/db';
import styles from './page.module.scss';

type Props = {
  searchParams: Promise<{ token?: string }>;
};

/**
 * Decodes the opaque unsubscribe token (base64url "<email>:<hmac>")
 * and verifies the HMAC. Returns the email if valid, null otherwise.
 */
function decodeToken(raw: string): string | null {
  let decoded: string;
  try {
    decoded = Buffer.from(raw, 'base64url').toString('utf-8');
  } catch (err) {
    console.error('[unsubscribe] token base64 decode error', err);
    return null;
  }

  const colonIdx = decoded.indexOf(':');
  if (colonIdx < 1) return null;

  const email = decoded.slice(0, colonIdx);
  const providedHmac = decoded.slice(colonIdx + 1);

  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error('[unsubscribe] UNSUBSCRIBE_SECRET missing');
  const expectedHmac = createHmac('sha256', secret).update(email).digest('hex');

  try {
    // Timing-safe comparison to prevent timing attacks.
    if (!timingSafeEqual(Buffer.from(expectedHmac), Buffer.from(providedHmac))) return null;
  } catch (err) {
    console.error('[unsubscribe] HMAC comparison error', err);
    return null;
  }

  return email;
}

export default async function UnsubscribePage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (typeof token !== 'string') {
    return (
      <main className={styles.main}>
        <p className={styles.error}>Invalid or expired link.</p>
      </main>
    );
  }

  const email = decodeToken(token);

  if (!email) {
    return (
      <main className={styles.main}>
        <p className={styles.error}>Invalid or expired link.</p>
      </main>
    );
  }

  try {
    await deactivateSubscriber(email);
  } catch (err) {
    console.error('[unsubscribe]', err);
    return (
      <main className={styles.main}>
        <p className={styles.error}>Server error, please try again later.</p>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Unsubscribed.</h1>
      <p className={styles.subtitle}>
        You&apos;ve been removed from wwwatch. Take care.
      </p>
    </main>
  );
}
