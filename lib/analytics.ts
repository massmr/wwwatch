/**
 * lib/analytics.ts — Typed track() helper for client-side PostHog capture.
 * Import only from 'use client' components — posthog-js is browser-only.
 *
 * For event name constants usable server-side, import from lib/analytics-events.ts.
 */
import posthog from 'posthog-js';

export {
  ARTICLE_LINK_CLICKED,
  EDITION_PUBLISHED,
  SOURCE_LINK_CLICKED,
  SUBSCRIBE_COMPLETED,
  SUBSCRIBE_STARTED,
} from './analytics-events';

// ── Event property shapes ─────────────────────────────────────────────────────

type EventMap = {
  article_link_clicked: { slug: string; category: string; position: number };
  source_link_clicked: { slug: string; domain: string };
  subscribe_started: Record<string, never>;
  subscribe_completed: { success: boolean };
  edition_published: { day: string; article_count: number };
};

// ── Typed track helper ────────────────────────────────────────────────────────

export function track<E extends keyof EventMap>(event: E, props: EventMap[E]): void {
  posthog.capture(event, props);
}
