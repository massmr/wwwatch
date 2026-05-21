/**
 * Formats a YYYY-MM-DD date string for display.
 * Uses UTC to avoid timezone-dependent off-by-one on the date.
 */
export function formatDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
