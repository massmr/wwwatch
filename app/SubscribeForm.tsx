'use client';

import { useActionState } from 'react';

import { subscribe, type SubscribeState } from './actions';
import styles from './SubscribeForm.module.scss';

const initial: SubscribeState = { status: 'idle' };

export function SubscribeForm() {
  const [state, formAction, pending] = useActionState(subscribe, initial);

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.row}>
        <input
          type="email"
          name="email"
          required
          placeholder="ton@email.com"
          className={styles.input}
          disabled={pending}
        />
        <button type="submit" disabled={pending} className={styles.button}>
          {pending ? '…' : "S'inscrire"}
        </button>
      </div>
      {state.status === 'error' && (
        <p className={styles.error}>{state.message}</p>
      )}
      {state.status === 'ok' && (
        <p className={styles.success}>{state.message}</p>
      )}
    </form>
  );
}
