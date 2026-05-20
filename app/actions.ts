'use server';

import { upsertSubscriber } from '@/lib/db';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SubscribeState =
  | { status: 'idle' }
  | { status: 'ok'; message: string }
  | { status: 'error'; message: string };

export async function subscribe(
  _prev: SubscribeState,
  formData: FormData
): Promise<SubscribeState> {
  const raw = formData.get('email');
  if (typeof raw !== 'string') {
    return { status: 'error', message: 'Email invalide.' };
  }

  const email = raw.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return { status: 'error', message: 'Email invalide.' };
  }

  try {
    await upsertSubscriber(email);
    return {
      status: 'ok',
      message: 'Inscrit. Le prochain brief arrive lundi matin.',
    };
  } catch (err) {
    console.error('[subscribe]', err);
    return { status: 'error', message: 'Erreur serveur, réessaie plus tard.' };
  }
}
