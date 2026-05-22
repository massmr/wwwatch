/**
 * lib/site-url.ts — Canonical site URL, single source of truth.
 * Import this constant instead of reading the env var directly in each module.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wwwatch.dev';
