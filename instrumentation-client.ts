/**
 * instrumentation-client.ts — Client-side instrumentation (Next.js 16).
 * Runs once before the application starts on the browser.
 * Initialises PostHog with cookieless mode (RGPD option A, see PLAN_6 §1).
 *
 * api_host points to the /ingest proxy (next.config.ts) so PostHog requests
 * are not blocked by ad-blockers.
 */
import posthog from 'posthog-js';

export function register(): void {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) {
    console.warn('[posthog] NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN not set — tracking disabled');
    return;
  }

  posthog.init(token, {
    api_host: '/ingest',
    ui_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
    defaults: '2026-01-30',
    capture_pageview: false, // captured manually via PostHogPageView (App Router)
    capture_pageleave: true,
    persistence: 'memory', // cookieless — option A, no consent banner required
  });
}
