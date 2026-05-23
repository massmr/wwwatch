# PLAN_6.md — Installation PostHog

**Version:** 1.0
**Date:** 21 mai 2026
**Portée:** instrumentation analytics complète de wwwatch (Next 16)
**À lire avec:** CONVENTIONS.md (priorité en cas de conflit)

---

## 0. État : MCP PostHog

- PostHog est dans tes connecteurs (utilisable depuis Claude Code / artifacts).
- **Le MCP n'installe pas le tracking.** Il sert à *interroger et gérer*
  la data : insights, requêtes, feature flags, error tracking. Utile
  **après** l'install, pas pour la faire.
- « Tout traquer » = installer le SDK dans l'app. C'est l'objet de ce plan.
- Une fois la data qui coule, le MCP devient intéressant : construire des
  insights, requêter les events, sans quitter Claude Code.

---

## 1. Décision préalable : consentement (RGPD)

Tu es en France, le site est public, donc RGPD s'applique. « Tout traquer »
n'est pas une décision purement technique. **À trancher avant de coder**
(je ne suis pas juriste, à valider de ton côté) :

| Option | Ce que ça implique | Consentement |
|---|---|---|
| **A. Cookieless / anonyme** | Pas de cookie persistant, pas d'identification cross-session. Pageviews + events agrégés. | Bandeau allégé voire non requis selon config |
| **B. Tracking complet + cookies** | Identification, funnels cross-session, session replay | Bandeau de consentement opt-in requis |

**Reco MVP :** commencer en **A (cookieless)**, ajouter le session replay
et l'identification (B) plus tard *avec* un bandeau de consentement. Tu
captes 90% de la valeur (pageviews, funnel subscribe, clics articles) sans
le poids juridique du replay. Le replay (option B) est le plus sensible :
il enregistre l'écran du visiteur.

**Host :** utilise le host **EU** (`https://eu.i.posthog.com`), pas US.
Données hébergées en UE, plus simple côté RGPD. Le projet PostHog doit être
créé en région EU (choix fait à la création, **non modifiable** ensuite).

---

## 2. Architecture d'intégration

Rappel du contexte wwwatch : site server-rendered, pages publiées en
`'use cache'`, pipeline en cron séparé. PostHog doit s'insérer **sans
casser ce modèle**.

Point clé : initialiser PostHog via un provider `'use client'` dans le
layout **ne force pas tout le site en dynamique** — les routes statiques et
SSR continuent de fonctionner. Le `'use client'` garantit juste que PostHog ne se charge pas côté serveur ; ça ne rend pas toute l'app client-side. Le nouveau package `@posthog/next` est même statique par défaut : le provider n'appelle pas d'API dynamique sauf si tu actives le bootstrap des flags.

Deux voies, tranchées dans le plan :

**Voie 1 (recommandée MVP) — `posthog-js` + `instrumentation-client.ts`.**
Bien rodée, ultra-documentée. Pour Next.js 15.3+, on utilise `instrumentation-client.ts` pour une intégration légère ; Next 16 le supporte. Init client + un composant de capture de pageview.

**Voie 2 (à évaluer) — package officiel `@posthog/next`.** Intégration unifiée App Router (React Server Components) avec provider en server-component, capture automatique des pageviews via le composant PostHogPageView, flags server-side, et respect du consentement opt-in/opt-out partout. Plus moderne et « static-safe », **mais récent (~2 semaines)** donc moins éprouvé.

**Décision :** partir sur la **Voie 1** (éprouvée, alignée CONVENTIONS),
noter `@posthog/next` dans `FUTURE.md` pour réévaluation quand il aura
mûri. On ne met pas un package de 2 semaines au cœur de l'analytics d'un
produit qu'on lance.

---

## 3. « Tout traquer », rendu concret

« Tout » en pratique = autocapture des pageviews **plus** les events métier
qui comptent pour wwwatch. Listés par priorité :

### Autocapture (gratuit, vient avec le SDK)
- Pageviews sur toutes les routes (landing, `/journal`, `/journal/[date]`,
  `/journal/[date]/[slug]`, `/about`). En App Router, la navigation est côté client, donc il faut capturer les pageviews manuellement aux changements de route — d'où le composant PostHogPageView.
- Clics, sessions, web analytics de base.

### Events métier (à instrumenter à la main) — c'est le cœur de la valeur
- **`subscribe_started`** / **`subscribe_completed`** : LE funnel nord. Lie
  directement au modèle de croissance/revenu. À poser sur le form et la
  route `/api/subscribe`.
- **`article_link_clicked`** : depuis la une `/journal/[date]`, quel
  article est cliqué. **Signal éditorial en or** (voir §7).
- **`source_link_clicked`** : clic sur le lien source sortant d'un article.
  Mesure si les lecteurs vont vraiment à la source.
- **`edition_viewed`** : une édition du jour consultée (avec la date).
- **`scroll_depth`** sur les pages article (optionnel) : profondeur de
  lecture réelle.

### Server-side (posthog-node)
- **`edition_published`** : émis par `publish.ts` quand tu publies une
  édition (nb d'articles, date). Te donne l'historique de publication dans
  PostHog.
- Capture des events subscribe côté serveur depuis la route API (source de
  vérité, à l'abri des ad-blockers).

### Error tracking
- Capture automatique des exceptions non gérées côté client via le SDK JS, plus le hook `onRequestError` dans `instrumentation.ts` pour les erreurs serveur. Précieux pour un projet solo.

---

## 4. Variables d'environnement

```env
# PostHog (le project token est une clé d'ingestion publique, conçue pour
# être exposée — NEXT_PUBLIC_ est donc correct ici, contrairement à
# DATABASE_URL. Voir note CONVENTIONS ci-dessous.)
NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=phc_xxx
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```

Ces valeurs doivent commencer par `NEXT_PUBLIC_` pour être accessibles côté client, et être ajoutées à `.env.local` et chez l'hébergeur (Vercel). Mettre à jour `.env.example`. Fail fast si manquantes au démarrage.

---

## 5. Phases d'implémentation

### Phase 0 — Créer le projet PostHog (toi, pas Claude Code)

- [ ] Créer un compte / projet PostHog **en région EU**. (Création de
  compte = action que tu fais toi-même, pas l'agent.)
- [ ] Récupérer le **project token** (`phc_...`) et le host EU.
- [ ] Choisir l'option de consentement (§1). Reco : cookieless au départ.

### Phase 1 — Install + init client + pageviews

- [ ] `npm install posthog-js`
- [ ] `.env.local` + `.env.example` : les 2 vars du §4. Fail fast.
- [ ] `instrumentation-client.ts` à la racine (Next 16) :
  ```ts
  import posthog from 'posthog-js'
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    defaults: '2026-01-30',
    capture_pageview: false, // capture manuelle (App Router, voir composant)
    persistence: 'memory',   // cookieless au départ (option A, §1)
  })
  ```
  L'option `defaults: '2026-01-30'` configure automatiquement les réglages recommandés.
- [ ] Composant `PostHogPageView` (`'use client'`, dans un sous-composant
  isolé, pas tout le layout) qui capture `$pageview` sur changement de
  `pathname`/`searchParams`, enveloppé dans un `<Suspense>` pour éviter les erreurs d'hydratation.
- [ ] Le wrapper provider reste un **sous-composant client minimal** monté
  dans `app/layout.tsx` (CONVENTIONS : pas de `'use client'` sur toute la
  page). Vérifier que les pages `'use cache'` restent bien statiques après
  ajout (un `'use client'` enfant ne les dynamise pas).

### Phase 2 — Events métier client

- [ ] `subscribe_started` au focus/submit du form ; `subscribe_completed`
  au succès retour API.
- [ ] `article_link_clicked` (props : slug, category, position dans la
  liste) sur les liens de la une.
- [ ] `source_link_clicked` (props : slug, source domain) sur le lien
  sortant des articles.
- [ ] Centraliser les noms d'events dans un petit module
  `lib/analytics.ts` (constantes `SCREAMING_SNAKE_CASE`, une fonction
  `track(event, props)` typée) — pas de strings magiques dispersées.

### Phase 3 — Server-side (posthog-node)

- [ ] `npm install posthog-node`
- [ ] Client server `lib/posthog-server.ts` (init + `flush`/`shutdown`
  propre en fin de requête/cron). Pour l'App Router, PostHog s'utilise dans les route handlers et server actions ; installer `posthog-node`.
- [ ] `/api/subscribe` : `capture('subscribe_completed')` côté serveur
  (source de vérité, hors d'atteinte des ad-blockers).
- [ ] `scripts/publish.ts` : `capture('edition_published', { day, count })`
  puis `shutdown()` (sinon les events ne partent pas en process court).

### Phase 4 — Error tracking

- [ ] Activer l'exception autocapture client (réglage projet PostHog +
  SDK).
- [ ] `instrumentation.ts` racine avec le hook `onRequestError` pour les
  erreurs serveur. Vérifier que ça tourne en runtime nodejs et récupérer le distinct_id depuis le cookie pour relier l'erreur à un utilisateur.

### Phase 5 — Reverse proxy anti-adblock (optionnel mais recommandé)

- [ ] Rewrite `/ingest/*` → host PostHog dans `next.config`, et pointer
  `api_host` sur `/ingest`. Évite qu'un ad-blocker bloque le tracking.
- [ ] Rappel Next 16 : le middleware s'appelle désormais `proxy.ts` (cf.
  CONVENTIONS), mais ici un simple rewrite `next.config` suffit, pas besoin
  de `proxy.ts`.

### Phase 6 — Session replay (optionnel, gated par consentement — option B)

- [ ] **Ne pas activer** tant que le bandeau de consentement n'est pas en
  place (§1). Quand ce sera le cas : activer le replay côté SDK,
  conditionné à l'opt-in.

---

## 6. Notes CONVENTIONS

1. **`NEXT_PUBLIC_` sur le token PostHog est OK.** CONVENTIONS interdit
   `NEXT_PUBLIC_` pour le sensible — mais le project token PostHog est une
   clé d'**ingestion publique**, conçue pour vivre côté client. Ce n'est
   pas un secret. `DATABASE_URL`, lui, ne sera jamais `NEXT_PUBLIC_`.
2. **`'use client'` minimal** : provider et PostHogPageView en
   sous-composants client isolés, jamais `'use client'` sur une page
   entière.
3. **Vérifier l'invariant `'use cache'`** : après ajout du provider, les
   pages publiées doivent rester statiques. Un enfant client ne dynamise
   pas un parent server, mais à confirmer au build (`✓ Generating static
   pages`).
4. **Pas de PII dans les events** : ne jamais envoyer l'email complet en
   property. Pour le funnel subscribe, un succès booléen suffit ; si tu
   identifies plus tard (option B), passe par l'`identify` PostHog, pas par
   des props en clair.
5. **`shutdown()` côté cron** : posthog-node bufferise ; sans flush/shutdown
   explicite en fin de `publish.ts`, l'event `edition_published` ne part
   pas.

---

## 7. Le vrai bénéfice : PostHog nourrit le sélecteur éditorial

Ne traque pas pour traquer. La donnée a un usage précis et stratégique
pour wwwatch.

On a un problème non résolu : **le sélecteur éditorial juge ce qui
*mérite* d'être publié, mais ne sait pas ce que les lecteurs *veulent*
vraiment.** PostHog ferme cette boucle. `article_link_clicked` et
`source_link_clicked`, agrégés par `category`, te disent quelles
catégories (funding ? security ? eval ?) génèrent le plus d'engagement
réel. Au bout de quelques semaines, tu sauras si ton intuition éditoriale
(« l'analyse compte, garde le backpressure ») est confirmée par les clics,
ou si les lecteurs ne lisent en fait que les releases de modèles.

C'est exactement le « construire le critère au fil des éditions » qu'on
s'était promis avec le log du sélecteur — sauf que là, c'est le
comportement des lecteurs qui informe le critère, pas seulement ton
jugement. À terme, ces signaux peuvent même réajuster les poids du scoring.

C'est ça, « tout traquer » avec un but : transformer l'analytics en boucle
de feedback éditoriale.

---

## 8. Toi vs Claude Code

**Toi :** Phase 0 (créer le projet PostHog EU, récupérer le token, trancher
le consentement). Et la validation au build que les pages restent
statiques.

**Claude Code :** Phases 1-5 (install, init, events, server-side, error
tracking, proxy). Phase 6 seulement après bandeau de consentement.

**Hors scope MVP → `FUTURE.md` :** `@posthog/next` (réévaluer quand mûri),
session replay + consentement (option B), identification cross-session,
réinjection des signaux PostHog dans les poids du scoring.

---

## Récap

- Le MCP PostHog n'installe rien ; il sert à requêter la data ensuite.
- Décision RGPD d'abord : cookieless au départ, host EU, replay plus tard
  avec consentement.
- Voie `posthog-js` + `instrumentation-client.ts` (éprouvée), pas
  `@posthog/next` (trop récent).
- Pageviews manuels (App Router), events métier centralisés dans
  `lib/analytics.ts`, server-side via posthog-node (subscribe + cron).
- Le vrai but : `article_link_clicked` par catégorie nourrit le jugement
  éditorial du sélecteur. Traquer pour décider, pas pour collectionner.
