'use client';

/**
 * PostHogInit — initialises PostHog once on the client via useEffect.
 *
 * Replaces instrumentation-client.ts which is unreliable in Vercel production
 * (experimental in Next.js 15.3, not guaranteed to run). This useEffect pattern
 * is the battle-tested approach for App Router.
 *
 * Mounted once in app/layout.tsx. PostHog is then available as a singleton
 * (posthog-js module) to any component that imports it.
 */
import posthog from 'posthog-js';
import { useEffect } from 'react';

export function PostHogInit(): null {
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    if (!token) {
      console.warn('[posthog] NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN not set — tracking disabled');
      return;
    }
    // Guard against double-init (React Strict Mode runs effects twice in dev).
    if (posthog.__loaded) return;

    posthog.init(token, {
      api_host: '/ingest',
      ui_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
      defaults: '2026-01-30',
      capture_pageview: false,  // captured manually via PostHogPageView
      capture_pageleave: true,
      persistence: 'memory',    // cookieless — RGPD option A
    });
  }, []);

  return null;
}
