/**
 * lib/analytics-events.ts — Event name constants, importable from any context
 * (server components, route handlers, scripts, client components).
 *
 * No posthog-js import here — this file is safe to import server-side.
 * For the typed track() helper (browser-only), import from lib/analytics.ts.
 */

export const ARTICLE_LINK_CLICKED = 'article_link_clicked' as const;
export const SOURCE_LINK_CLICKED = 'source_link_clicked' as const;
export const SUBSCRIBE_STARTED = 'subscribe_started' as const;
export const SUBSCRIBE_COMPLETED = 'subscribe_completed' as const;
export const EDITION_PUBLISHED = 'edition_published' as const;
