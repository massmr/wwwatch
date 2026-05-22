import type { NextConfig } from 'next';

// PostHog EU host — requests are proxied through /ingest to bypass ad-blockers (PLAN_6 §5 Phase 5).
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // FUTURE(maintainer, 2026-07-01): enable experimental.dynamicIO once 'use cache'
  // is confirmed stable in this Next build (see app/journal/[date]/[slug]/page.tsx).

  async rewrites() {
    return [
      // Proxy PostHog static assets and event ingestion through /ingest.
      // instrumentation-client.ts sets api_host: '/ingest' for this to work.
      {
        source: '/ingest/static/:path*',
        destination: `${POSTHOG_HOST}/static/:path*`,
      },
      {
        source: '/ingest/:path*',
        destination: `${POSTHOG_HOST}/:path*`,
      },
    ];
  },
};

export default nextConfig;
