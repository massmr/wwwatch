/**
 * POST /api/subscribe — HTTP endpoint for external integrations (curl, embed forms).
 * Internal form submissions use the Server Action in app/actions.ts instead.
 * Per PLAN_3 §5.
 */
import { type NextRequest, NextResponse } from 'next/server';

import { upsertSubscriber } from '@/lib/db';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const raw = (body as Record<string, unknown>)?.['email'];
  if (typeof raw !== 'string') {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  const email = raw.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  try {
    await upsertSubscriber(email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[subscribe] db error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
