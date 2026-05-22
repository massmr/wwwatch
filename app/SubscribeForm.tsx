'use client';

import { useActionState, useEffect, useRef } from 'react';

import { SUBSCRIBE_COMPLETED, SUBSCRIBE_STARTED, track } from '@/lib/analytics';

import { subscribe, type SubscribeState } from './actions';
import styles from './SubscribeForm.module.scss';

const initial: SubscribeState = { status: 'idle' };

export function SubscribeForm() {
  const [state, formAction, pending] = useActionState(subscribe, initial);

  // Guard: fire subscribe_started only once per form mount.
  const startedRef = useRef(false);

  // Guard: track each terminal status exactly once.
  // The ref stores the last status already tracked so React Strict Mode's
  // double-invocation of effects does not emit duplicate events.
  const trackedStatusRef = useRef<SubscribeState['status']>('idle');

  useEffect(() => {
    if (state.status === 'ok' && trackedStatusRef.current !== 'ok') {
      trackedStatusRef.current = 'ok';
      track(SUBSCRIBE_COMPLETED, { success: true });
    } else if (state.status === 'error' && trackedStatusRef.current !== 'error') {
      trackedStatusRef.current = 'error';
      track(SUBSCRIBE_COMPLETED, { success: false });
    }
  }, [state.status]);

  function handleFocus() {
    if (!startedRef.current) {
      startedRef.current = true;
      track(SUBSCRIBE_STARTED, {});
    }
  }

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.row}>
        <input
          type="email"
          name="email"
          required
          placeholder="your@email.com"
          className={styles.input}
          disabled={pending}
          onFocus={handleFocus}
        />
        <button type="submit" disabled={pending} className={styles.button}>
          {pending ? '…' : 'Subscribe'}
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
