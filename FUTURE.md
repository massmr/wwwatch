# FUTURE.md — Deferred ideas and unplugged features

Items here are explicitly out of scope for the current build. Do not implement
without a deliberate decision.

---

## Reddit collector (currently unplugged)

**File:** `lib/collectors/reddit.ts`
**Status:** Code is intact, not wired into `lib/collectors/index.ts`.

**What it does:**
Hits the `/r/<subreddit>/hot.json` endpoint (no auth required) for a fixed list
of AI-focused subreddits: LocalLLaMA, ClaudeAI, MachineLearning, LangChain,
ChatGPT. Returns link posts only (`is_self = false`). Uses
`url_overridden_by_dest` when present as the canonical outbound URL, and stores
the Reddit thread permalink in `discovery_url` for secondary citation.

**Why it is unplugged:**
The subreddits above skew heavily toward memes, screenshots, and self-posts that
have no fetchable external source. Even after filtering self-posts, a large
fraction of link posts point to images (`i.redd.it`), Twitter, or paywalled
pages that the enrich step cannot fetch. The result is that Reddit items flood
the top-20 scoring slots and then all drop in enrich, leaving the pipeline with
zero articles.

**To reactivate:**
1. Re-add the import and entry in `lib/collectors/index.ts`:
   ```ts
   import { collectReddit } from './reddit';
   // in COLLECTORS array:
   { name: 'reddit', fn: collectReddit },
   ```
2. Consider restricting to subreddits with a higher ratio of link posts to
   genuine external articles (e.g. MachineLearning, LocalLLaMA papers threads).
3. Consider adding a `post_hint === 'link'` filter in the collector, or filtering
   by known-good outbound domains (github.com, arxiv.org, blog domains).
4. The scoring authority for `reddit_*` is already at 0.35 (discovery tier),
   which is appropriate.
