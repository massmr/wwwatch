/**
 * lib/posthog-server.ts — PostHog Node.js client factory for server-side capture.
 *
 * Returns a fresh PostHog instance. Callers MUST call shutdown() after use:
 * posthog-node buffers events and flushes on shutdown — without it, events
 * are lost in short-lived processes (API routes, cron scripts).
 *
 * Usage:
 *   const ph = createPostHogServer();
 *   ph.capture({ distinctId: 'anonymous', event: 'my_event', properties: {} });
 *   await ph.shutdown();
 */
import { PostHog } from 'posthog-node';

export function createPostHogServer(): PostHog {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';
  if (!token) throw new Error('[posthog-server] NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN missing');
  return new PostHog(token, { host });
}
