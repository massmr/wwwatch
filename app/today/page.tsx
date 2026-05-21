// Redirect target changes with each new edition — must be dynamic.
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';

import { getLatestPublishedEdition } from '@/lib/db';

/** Redirects to the most recent published edition, or to /journal if none. */
export default async function TodayPage() {
  const edition = await getLatestPublishedEdition();
  redirect(edition ? `/journal/${edition.day}` : '/journal');
}
