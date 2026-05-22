# FUTURE.md — Deferred ideas and unplugged features

Items here are explicitly out of scope for the current build. Do not implement
without a deliberate decision.

---

## PostHog — Analytics & instrumentation

**Plan source :** PLAN_6.md (v1.0, 21 mai 2026)

### Hors scope MVP (à implémenter après)

- **`@posthog/next`** : package officiel PostHog pour App Router (RSC, flags server-side, pageviews automatiques). Trop récent (~2 semaines à date du plan). Réévaluer quand il aura mûri — actuellement on part sur `posthog-js` + `instrumentation-client.ts`.
- **Session replay + bandeau de consentement (option B)** : enregistrement écran visiteur. Requiert un bandeau opt-in RGPD avant activation. Ne pas activer tant que le consentement n'est pas en place.
- **Identification cross-session** : `posthog.identify()` avec un ID utilisateur. Utile pour les abonnés — à faire après le replay et le consentement.
- **Réinjection des signaux PostHog dans les poids du scoring** : une fois que `article_link_clicked` par catégorie a accumulé assez de données, réajuster les poids du sélecteur éditorial à partir des signaux d'engagement réels. C'est le vrai endgame de l'analytics.

### Contexte éditorial (à garder en tête)

`article_link_clicked` et `source_link_clicked` agrégés par `category` = signal pour savoir si l'intuition éditoriale (« l'analyse compte, garde le backpressure ») est confirmée ou infirmée par les clics lecteurs. Peut nourrir les poids du scoring à terme.

### Architecture retenue (MVP)

- Voie : `posthog-js` + `instrumentation-client.ts` (Next 16)
- Host : EU (`https://eu.i.posthog.com`) — non modifiable après création projet
- Consentement : cookieless au départ (`persistence: 'memory'`), replay plus tard
- Events métier centralisés dans `lib/analytics.ts` (constantes `SCREAMING_SNAKE_CASE`)
- Server-side via `posthog-node` dans `/api/subscribe` et `scripts/publish.ts`

### Note CONVENTIONS

`NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` est une clé d'ingestion publique conçue pour vivre côté client — l'exception à la règle `NEXT_PUBLIC_` est documentée et intentionnelle.

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
