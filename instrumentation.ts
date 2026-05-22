/**
 * instrumentation.ts — Server-side instrumentation (Next.js 16).
 * Captures unhandled server errors to PostHog via onRequestError.
 *
 * Runs in the Node.js runtime. Requires NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN.
 * If the token is absent (e.g. local dev without PostHog configured), the
 * hook exits silently — the error is still logged by Next.js itself.
 */

export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routePath: string; routeType: string },
): Promise<void> {
  if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return;

  try {
    const { createPostHogServer } = await import('@/lib/posthog-server');
    const message = err instanceof Error ? err.message : String(err);

    const ph = createPostHogServer();
    ph.capture({
      distinctId: 'server-error',
      event: '$exception',
      properties: {
        $exception_message: message,
        path: request.path,
        method: request.method,
        routePath: context.routePath,
        routeType: context.routeType,
      },
    });
    await ph.shutdown();
  } catch (captureErr) {
    console.error('[instrumentation] PostHog capture failed:', captureErr);
  }
}
