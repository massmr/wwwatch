import { collectHackerNews } from './hacker-news';
import { collectGithub } from './github';
import { collectHuggingFace } from './hugging-face';
import { collectRss } from './rss';
// Reddit is currently unplugged — see FUTURE.md for reactivation notes.
import type { RawItem } from './types';

export type { RawItem } from './types';
export { normalizeFingerprint } from './types';

type Collector = () => Promise<RawItem[]>;

const COLLECTORS: Array<{ name: string; fn: Collector }> = [
  { name: 'hacker_news', fn: collectHackerNews },
  { name: 'github', fn: collectGithub },
  { name: 'hugging_face', fn: collectHuggingFace },
  { name: 'rss', fn: collectRss },
];

/**
 * Runs all collectors concurrently.
 * Dead sources are logged but never crash the run (Promise.allSettled).
 * Returns a URL-deduped flat list of raw items.
 */
export async function collectAll(): Promise<RawItem[]> {
  const results = await Promise.allSettled(COLLECTORS.map(({ fn }) => fn()));

  const all: RawItem[] = [];
  results.forEach((result, i) => {
    const name = COLLECTORS[i]?.name ?? `collector[${i}]`;
    if (result.status === 'fulfilled') {
      console.log(`[collectors] ${name}: ${result.value.length} items`);
      all.push(...result.value);
    } else {
      // Individual collector errors should be caught inside each collector —
      // reaching here means an unexpected uncaught throw.
      const msg =
        result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.error(`[collectors] ${name} failed: ${msg}`);
    }
  });

  // URL dedup: same URL from multiple sources → keep first occurrence.
  const seenUrls = new Set<string>();
  const deduped = all.filter((item) => {
    if (seenUrls.has(item.url)) return false;
    seenUrls.add(item.url);
    return true;
  });

  console.log(
    `[collectors] total: ${all.length} items, ${all.length - deduped.length} URL dupes removed → ${deduped.length} unique`
  );

  return deduped;
}
