'use client';

/**
 * PostHogPageView — captures $pageview on every client-side route change.
 *
 * App Router navigations are client-side; Next.js does not reload the page,
 * so PostHog's automatic pageview capture misses them. This component listens
 * to pathname + searchParams changes and fires manually.
 *
 * Must be wrapped in <Suspense> at the call site because useSearchParams()
 * suspends during SSR — without Suspense the build throws.
 */
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { useEffect } from 'react';

export function PostHogPageView(): null {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const url =
      searchParams.size > 0
        ? `${pathname}?${searchParams.toString()}`
        : pathname;
    posthog.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}
