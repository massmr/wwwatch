# PLAN_3.md — wwwatch Daily Pipeline

**Version:** 3.1
**Date:** 21 mai 2026
**Remplace:** la génération à la volée (`lib/research.ts` + web_search dans le serveur Next)
**À lire avec:** CONVENTIONS.md (priorité en cas de conflit)

> **v3.1 — corrections issues du premier dry-run (5 articles).** Quatre fixes intégrés
> aux étapes 2 à 5, marqués « Correction v3.1 » dans le texte. Résumé : (1) le writer
> n'écrit plus que depuis le contenu source réellement récupéré, interdiction de combler ;
> (2) le scoring privilégie la fraîcheur événementielle sur la popularité brute ;
> (3) l'intro du jour est générée en dernier, depuis les summaries finaux ;
> (4) la QA trace chaque détail factuel à une source. Détail factuel des specs vérifié OK
> au dry-run (Ollama 172K, Qwen 3.6 SWE-bench 77.2, Kimi K2.6) — le problème n'était pas
> les specs mais le comblement de détails quand la source est vague.

---

## Table des matières

1. [Ce qu'on construit, ce qu'on arrache](#1-ce-quon-construit-ce-quon-arrache)
2. [Principe d'architecture](#2-principe-darchitecture)
3. [Langue : EN-only au MVP](#3-langue--en-only-au-mvp)
4. [Modèle de données](#4-modèle-de-données)
5. [Les sources, par rôle](#5-les-sources-par-rôle)
6. [Le pipeline en 6 étapes](#6-le-pipeline-en-6-étapes)
7. [L'UX journal](#7-lux-journal)
8. [Phases d'implémentation](#8-phases-dimplémentation)
9. [Cron & déploiement](#9-cron--déploiement)
10. [Coûts](#10-coûts)
11. [Variables d'environnement](#11-variables-denvironnement)
12. [Hors scope MVP](#12-hors-scope-mvp)

---

## 1. Ce qu'on construit, ce qu'on arrache

### On arrache

- **`lib/research.ts`** : la génération de brief à la volée via Claude + `web_search`. Source du comportement « random ». Supprimé.
- **`scripts/brief.ts`** (référencé dans `package.json` via `brief:dry`) : l'ancien orchestrateur hebdo monolithique. Remplacé par `scripts/daily.ts` + `scripts/weekly.ts`.
- **Tout texte en français côté produit** : prompts, templates email, futures pages. On part d'une VF, on traduit **tout** en anglais (voir §3).

### On construit

Un pipeline déterministe en CLI qui collecte, score, enrichit, rédige, contrôle et stocke des articles en DB. Le serveur Next ne fait plus que **lire la DB et rendre des pages**. Plus aucun appel LLM dans le chemin d'une requête web.

```
AVANT (arraché)                    APRÈS (PLAN_3)
─────────────────                  ──────────────────────────────
requête web                        cron quotidien (GH Actions)
   ↓                                  ↓
serveur Next                       scripts/daily.ts
   ↓                                  ↓ collect → score → enrich
lib/research.ts                       ↓ → write → QA → store DB
   ↓ Claude + web_search                          ↓
   ↓ (latence, coût, random)        ┌─────────────────────────┐
brief renvoyé                       │ Neon: editions/articles  │
                                    └─────────────────────────┘
                                                  ↑ lecture seule
                                       serveur Next (pages cachées)
```

---

## 2. Principe d'architecture

**Séparation stricte génération / rendu.**

| | Génère | Rend |
|---|---|---|
| **Quoi** | `scripts/daily.ts`, `scripts/weekly.ts` | `app/**` |
| **Quand** | Cron (1×/jour, 1×/semaine) | À chaque requête (mais caché) |
| **Touche LLM** | Oui (write, intro, QA) | **Jamais** |
| **Touche DB** | Écriture | Lecture seule |
| **Déclencheur** | GitHub Actions | Trafic utilisateur |

Conséquences concrètes :
- Le site est instantané et entièrement cacheable (`'use cache'` sur pages publiées).
- Un échec du pipeline ne casse jamais le site (il sert la dernière édition publiée).
- Les coûts LLM sont bornés et prévisibles (pas indexés sur le trafic).
- Le pipeline est un cron ennuyeux et fiable, pas un système temps réel.

**Pas d'agent team.** Le pipeline est un flux de données déterministe : collect → score → enrich → write → store. Les seuls appels LLM (rédaction d'article, intro du jour, passe QA) sont des *appels* discrets, pas des agents autonomes en boucle. Y ajouter une orchestration multi-agents ajouterait latence, coût, non-déterminisme et modes de panne — l'inverse de ce qu'on veut pour un cron. Voir CONVENTIONS.md §« Pipeline » règle 1.

---

## 3. Langue : EN-only au MVP

**Tout le produit est en anglais.** On est parti d'une VF, il faut **tout traduire**.

### À traduire (existant FR → EN)

- `lib/prompt.ts` : entièrement réécrit en anglais (le prompt actuel commence par « NE NARRATE JAMAIS TON PROCESSUS »). La sortie LLM doit être en anglais.
- `emails/weekly-brief.tsx` + `emails/components/*` : tout label, footer, preview text.
- Toute string visible utilisateur dans `app/**` (à créer en EN d'emblée).
- Les commentaires de code peuvent rester FR (interne), mais **tout contenu publié est EN**.

### Préparer le bilingue sans le faire

Le PDF identifie le white space comme FR-EN. On ne le construit pas au MVP (×2 coût d'écriture, ×2 SEO à gérer, ralentit le ship), **mais on ne se ferme pas la porte** :

- Colonne `lang` (`'en'` par défaut) dans `articles` et `editions` dès le départ.
- Les routes prévoient un préfixe langue futur (`/en/journal/...`) — au MVP, pas de préfixe, EN implicite. Noté dans `FUTURE.md`.

---

## 4. Modèle de données

Migrations versionnées dans `neon/` (jamais de clic dans la console Neon). Accès via `getSql()` en tagged templates. Deux tables existent déjà (`subscribers`, `briefs`), on en ajoute trois.

### `neon/0002_pipeline.sql`

```sql
-- Une édition = un numéro de journal pour un jour donné.
create table editions (
  day            date primary key,
  lang           text not null default 'en',
  intro_md       text not null default '',
  status         text not null default 'draft',   -- 'draft' | 'published'
  article_count  integer not null default 0,
  created_at     timestamptz not null default now(),
  published_at   timestamptz
);

create index editions_status_day_idx on editions (status, day desc);

-- Un article = une page SEO. Rattaché à une édition.
create table articles (
  id           uuid primary key default gen_random_uuid(),
  day          date not null references editions (day) on delete cascade,
  lang         text not null default 'en',
  slug         text not null,
  title        text not null,
  category     text not null,        -- voir liste §6 / CONVENTIONS
  summary      text not null,        -- 1-2 lignes, sert la page sommaire + newsletter
  body_md      text not null,        -- 300-500 mots markdown
  sources      jsonb not null default '[]',  -- [{ "url", "source", "title" }]
  fingerprint  text not null,        -- titre normalisé, anti-doublon inter-jours
  score        real not null default 0,
  status       text not null default 'draft', -- suit l'édition mais flaggable indiv.
  created_at   timestamptz not null default now(),
  unique (day, slug)
);

create index articles_day_idx on articles (day desc);
create index articles_category_idx on articles (category);
create index articles_fingerprint_idx on articles (fingerprint);

-- Items bruts collectés. Gardés ~30j pour audit, scoring, dédup.
create table raw_items (
  id            text primary key,    -- ex: 'hn_40392847'
  source        text not null,       -- 'hacker_news', 'rss_anthropic', ...
  title         text not null,
  url           text not null,
  description   text,
  published_at  timestamptz not null,
  upvotes       integer,
  stars         integer,
  comments      integer,
  score         real,
  fingerprint   text not null,
  collected_at  timestamptz not null default now()
);

create index raw_items_collected_idx on raw_items (collected_at desc);
create index raw_items_score_idx on raw_items (score desc);
```

### Cycle de vie d'une édition

```
cron daily.ts → INSERT edition (status='draft') + N articles (status='draft')
                              ↓
        [premières semaines] tu lis /journal/<day> en mode preview
                              ↓
        tu publies : UPDATE editions SET status='published', published_at=now()
                              ↓
        revalidation cache → page live + indexable
```

Au MVP, la publication est **manuelle** (un script `scripts/publish.ts <day>` ou un flag). Quand tu fais confiance au système, tu passes `status='published'` directement dans `daily.ts`. Ce garde-fou est la raison d'être du champ `status` — voir CONVENTIONS.md §« Pipeline » règle 4.

### Nettoyage `briefs` existant

La table `briefs` actuelle stockait `markdown` + `html` du brief hebdo monolithique. On la garde pour l'historique d'envoi, mais le brief hebdo est désormais **composé depuis les `articles`** de la semaine (voir §6, étape weekly). Pas de régénération LLM pour le brief.

---

## 5. Les sources, par rôle

Quatre rôles, pas un simple classement par effort. Chaque collector vit dans `lib/collectors/<source>.ts`, retourne un `RawItem[]`, et ne dépend de rien d'autre (testable isolément).

### Rôle 1 — Découverte (« qu'est-ce qui est chaud ? »)

| Source | Accès | Filtre |
|---|---|---|
| Hacker News | Algolia API | `points > 50`, keywords agentic |
| GitHub Trending | API/scrape | Python/TS/Rust, `stars_today > 100`, keywords |
| Reddit | JSON API | r/LocalLLaMA, r/ClaudeAI, r/MachineLearning, r/LangChain, r/ChatGPT — `score > 50` |
| Hugging Face | Daily Papers API | keywords agentic |
| Product Hunt *(Tier 2)* | GraphQL | topics AI / Developer Tools |

### Rôle 2 — Sources primaires (« la vérité officielle »)

RSS / changelogs. Zéro bruit, specs et pricing exacts. **Ne pas enrichir** (déjà complet).

Anthropic, OpenAI, Google DeepMind, Meta AI (blogs RSS) · Cursor, Vercel, GitHub, LangChain (changelogs) · **Microsoft** (Agent 365, sujet enterprise majeur).

### Rôle 3 — Signal-de-signal (« ce que les autres curateurs ont retenu »)

On ne republie pas — on regarde ce qu'ils ont **sélectionné** et on croise. Un item vu chez 2+ → bonus de score ×1,5.

AINews / Smol AI (swyx, daily) · The AI Daily Brief (NLW, enterprise agentic) · TLDR AI · Ben's Bites · Turing Post · Latent Space.

### Rôle 4 — Différenciation (les angles que personne ne couvre)

**C'est l'edge vs The Rundown (surface) et Latent Space (hebdo).** Catégorie éditoriale prioritaire, pas un sous-produit. Le PDF identifie ces sujets comme sous-couverts :

| Angle | Sources |
|---|---|
| VC / funding | TechCrunch (rounds), Crunchbase News |
| Benchmarks / évals | AgentMarketCap, Terminal-Bench, LangSmith/Arize/Galileo |
| Sécurité | OWASP Agentic Top 10, breaches notables |
| FinOps agentique | Annonces pricing Anthropic/OpenAI (pas de source unique) |

### On NE fait PAS au MVP

- **Twitter/X API** ($100/mois) : signal déjà capté ailleurs, cher. → `FUTURE.md`.
- **Scraping Discord** : gris légalement, fragile. → `FUTURE.md`.

---

## 6. Le pipeline en 6 étapes

`scripts/daily.ts`, déterministe. Chaque étape = une fonction pure ou quasi-pure dans `lib/`.

### Étape 1 — Collecte (`lib/collectors/index.ts`)

```ts
// Une source morte ne tue pas le run.
const results = await Promise.allSettled(collectors.map((c) => c()));
```

Sortie : 100-200 `RawItem`. Chaque échec est loggué `[collectors] <source> failed`, le run continue.

### Étape 2 — Dédup + scoring (`lib/scoring.ts`)

> **Correction v3.1 (dry-run du 21 mai).** Le premier dry-run a remonté 4 repos GitHub
> sur 5 (OpenHands, nanobot, browser-use…) — populaires mais **pas des news**. Le
> scoring sur-pondérait la popularité brute (étoiles) au détriment de la fraîcheur
> événementielle. On corrige la pondération ci-dessous.

1. **Fingerprint** : titre normalisé (lowercase, sans ponctuation, sans stop-words). Sert au dédup intra-run ET inter-jours (ne pas réécrire la même histoire demain).
2. **Dédup** par URL exacte + par fingerprint similaire (même lancement sur HN + Reddit + blog = 1 sujet).
3. **Score** = `event_freshness·0.45 + authority·0.25 + engagement·0.20 + keywords·0.10`, puis **×1,5 si cross-source** (rôle 3).
   - `event_freshness` n'est PAS « date de création du repo ». C'est « y a-t-il un **événement daté** dans la fenêtre 7 jours ? » : release/version, levée, incident, breaking change, annonce. Un repo établi sans événement récent score bas, même à 100K étoiles.
   - `engagement` (étoiles absolues, points HN) est **plafonné** (`log` ou cap) pour qu'un repo très populaire mais statique ne domine pas un vrai scoop moins étoilé.
   - Heuristique anti-« fiche produit » : si l'item est un repo GitHub **sans** `stars_today`/release récente détectable, pénalité (il est probablement « populaire » mais pas « nouveau »).
4. Garder le top 15-20.

Le gabarit cible = l'article « OpenAI disproves conjecture » du dry-run : un **événement daté** avec un angle, pas une présentation de projet. Détail de la formule : voir SOURCES_PIPELINE.md.

Persister les `raw_items` scorés (audit/dédup futur).

### Étape 3 — Enrichissement & récupération du contenu (`lib/enrich.ts`)

> **Correction v3.1 (dry-run du 21 mai).** Cause racine du problème de fond : le writer
> recevait un **titre + une URL** et brodait avec sa connaissance interne. D'où des
> détails fabriqués quand la source est vague (cf. OpenHands « agnostique 100+ providers »
> transformé à tort en « GPT-4o, Claude 3.5 Sonnet » — des modèles de 2024). Le fix : cette
> étape doit produire la **matière factuelle réelle** que le writer aura le droit d'utiliser,
> et **rien d'autre**.

Pour chaque item du top 15-20, produire un **bloc de matière source** (`source_material`) :

1. **`fetch` du contenu réel** de la page source (README GitHub, changelog, blog officiel, fil HN). Extraire le texte utile (markdown/texte, pas le HTML brut). C'est la **matière obligatoire** passée au writer.
2. **`web_search` complémentaire et sélectif** (version `web_search_20250305`, cf. CONVENTIONS) **uniquement** si un angle de différenciation manque : pricing, benchmark chiffré, réaction d'expert, montant de levée. Une source primaire déjà complète (changelog officiel) → **skip** le web_search.
3. **Conserver la provenance** : chaque fait récupéré garde son URL d'origine, pour alimenter `articles.sources` et permettre au garde-fou QA (étape 5) de tracer chaque détail.

Sortie : un `source_material` structuré (texte + liste d'URLs sourcées) par item. Si le `fetch` échoue et qu'il n'y a aucune matière exploitable, l'item est **écarté** (pas d'article écrit sur du vide). Logguer `[enrich] <item> dropped: no source content`.

### Étape 4 — Rédaction (`lib/writer.ts`)

> **Correction v3.1 (dry-run du 21 mai).** Deux bugs : (a) le writer comblait les détails
> manquants avec sa mémoire interne ; (b) l'intro du jour divergeait des articles
> (« Kimi K2.5 » + « MiniMax » dans l'intro alors que les articles disaient « K2.6 » et ne
> mentionnaient pas MiniMax) — signe qu'elle tournait **en parallèle**, sans voir le contenu final.

- 1 appel **Sonnet** (`claude-sonnet-4-6`) par article → 300-500 mots markdown + summary + catégorie.
- **Le writer n'écrit QUE depuis le `source_material` de l'étape 3.** Instruction dure dans le prompt :
  - « N'écris que ce qui est présent dans les sources fournies. »
  - « Si un détail manque (modèles supportés, chiffres, dates, versions), ne l'invente pas : écris ce que la source dit, ou omets-le. »
  - « Là où la source est générique (ex. "model-agnostic"), reste générique. N'illustre pas avec des exemples concrets non présents dans la source. »
  - Le tic à tuer : le writer adore la couleur concrète → il fabrique du spécifique quand la source est abstraite. C'est plausible, donc dangereux.
- **L'intro du jour est générée EN DERNIER**, à partir des `summary` **finaux** des articles retenus — jamais en parallèle, jamais depuis les items bruts. Elle ne doit mentionner que des éléments présents dans les articles publiés de l'édition.
- **Pas de Haiku.** La qualité d'écriture est le seul moteur de forward et de SEO ; économiser sur le modèle dégraderait le seul avantage du produit.

**Catégories** (`articles.category`) :
`coding_agent` · `framework` · `infra_api` · `research` · `tool` · `funding` · `security` · `eval` · `ops` (finops/observabilité/gouvernance).

### Étape 5 — Garde-fou qualité (`lib/editor.ts`)

> **Correction v3.1 (dry-run du 21 mai).** L'editor n'a rien attrapé : un article citait
> « Claude 3.5 Sonnet / GPT-4o » (2024) absents de la source. Le comblement est **plausible
> par construction**, donc dur à détecter automatiquement — d'où la relecture humaine
> obligatoire au début, ce n'est pas optionnel.

Avant écriture en `published`. Flague (ne supprime pas silencieusement), passe l'article en `draft` s'il échoue :
- **Détail factuel non traçable** : tout nom de modèle, chiffre, date, version, montant cité dans l'article doit se retrouver dans le `source_material` / `sources`. Sinon → flag « unsourced detail ». C'est le contrôle le plus important post-dry-run.
- doublons sémantiques résiduels (fingerprint proche d'un article récent),
- articles trop courts (< 200 mots) ou trop génériques,
- articles sans aucune source vérifiable dans `sources`.

Le contrôle « détail non traçable » est imparfait (un LLM juge ne rattrapera pas tout). Tant que la qualité n'est pas prouvée, **tout reste `draft` et tu lis avant de publier** — c'est le 1-2h/semaine réel et le seul vrai filet contre le comblement. Voir CONVENTIONS §« Pipeline » règles 4 et 5.

### Étape 6 — Stockage + édition (`lib/db.ts`)

`upsert` de l'`edition` du jour + `insert` des `articles`. Statut `draft`. Le rendu se fait depuis la DB.

### Pipeline hebdo (`scripts/weekly.ts`, lundi)

Rescore les `articles` des 7 derniers jours (`published`), sélectionne le top 5-8, compose le brief **depuis les `summary` existants** (coût LLM marginal nul ou un seul petit appel de mise en forme), envoie via `lib/email.ts` (React Email + HMAC unsubscribe), logue dans `briefs`.

---

## 7. L'UX journal

Métaphore « éditions » (numéros de journal). Pages publiées en `'use cache'`, invalidées à la publication.

### Routes

| Route | Rôle | Source |
|---|---|---|
| `/` | Landing « built by builders » + aperçu édition du jour + subscribe | dernière édition `published` |
| `/journal` | Archive anté-chrono des éditions (distribution du link-juice) | `editions` |
| `/journal/[date]` | La une du jour : `intro_md` + carte des articles par catégorie | 1 édition + ses articles |
| `/journal/[date]/[slug]` | Page article (page SEO money) | 1 article |
| `/about` | Story « built by builders », explication du pipeline | statique |

`[date]` au format `YYYY-MM-DD`. Rappel Next 16 : `params` est une Promise → `const { date, slug } = await params`.

### Navigation globale

`Today` (redirige vers la dernière édition `published`) · `Journal` (archive) · `Subscribe` · `About`.

### Rendu markdown

`body_md` / `intro_md` → HTML via `marked`, **sanitizé** (sortie LLM = non fiable). Jamais de `dangerouslySetInnerHTML` sur du markdown LLM non sanitizé. Styles : SCSS modules + tokens (pas de Tailwind, pas de couleur hardcodée).

### Pas au MVP

Pages catégorie dédiées (`/journal/category/security`), recherche, pagination fine. → `FUTURE.md`.

---

## 8. Phases d'implémentation

Une phase à la fois. `npm run build` doit passer avant chaque commit. Conflit PLAN/CONVENTIONS → CONVENTIONS gagne.

### Phase 0 — Correctif & traduction (préalable)

- [ ] **Fix `package.json`** : le scaffold affiche à tort `next: ^15.1.6`. Le référentiel projet est **Next 16.0.0** (pin exact, pas `^16`). Corriger. React 19 OK. CONVENTIONS.md est déjà aligné Next 16 (params async, `proxy.ts`, `'use cache'`) — ne rien y changer côté version.
- [ ] Ajouter deps : `rss-parser`, et confirmer `marked` présent.
- [ ] Mettre à jour `scripts` : retirer `brief:dry`, ajouter `daily`, `daily:dry`, `weekly`, `weekly:dry`, `publish`.
- [ ] **Traduire `lib/prompt.ts` en anglais** (réécriture complète, sortie EN).
- [ ] **Traduire `emails/**` en anglais**.
- [ ] Créer `app/_styles/{globals,tokens,mixins}.scss`.
- [ ] `.env.example` à jour.

### Phase 1 — Schéma DB

- [ ] `neon/0002_pipeline.sql` (cf. §4).
- [ ] Exécuter sur Neon.
- [ ] `lib/db.ts` : `getSql()` + fonctions `upsertEdition`, `insertArticles`, `getEdition`, `getArticle`, `listPublishedEditions`, `getArticlesForWeek`, `saveRawItems`. Tagged templates only.

### Phase 2 — Collectors (rôles 1 & 2 d'abord)

- [ ] `lib/collectors/types.ts` (`RawItem`).
- [ ] `hacker-news.ts`, `github.ts`, `hugging-face.ts`, `reddit.ts`, `rss.ts`.
- [ ] `index.ts` orchestrateur (`Promise.allSettled` + dédup URL).
- [ ] `daily:dry` : log des items collectés, aucune écriture.

### Phase 3 — Scoring + enrich + writer + editor

- [ ] `lib/scoring.ts` (fingerprint, dédup sémantique, score, cross-source ×1,5).
- [ ] `lib/enrich.ts` (web_search sélectif).
- [ ] `lib/writer.ts` (Sonnet, articles + intro, catégorisation).
- [ ] `lib/editor.ts` (garde-fou qualité, flags).
- [ ] **STOP** : générer 3 jours en `daily:dry`, lire la sortie, valider la qualité avant de continuer.

### Phase 4 — Pipeline quotidien

- [ ] `scripts/daily.ts` (6 étapes, flag `DRY_RUN`).
- [ ] `scripts/publish.ts <day>` : passe une édition `draft` → `published` + déclenche la revalidation cache.
- [ ] Premier run prod réel : génère une édition `draft`, vérifier en DB.

### Phase 5 — Rendu (pages journal)

- [ ] `app/_styles/` finalisés (tokens, globals, mixins).
- [ ] `app/layout.tsx` : nav globale (Today / Journal / Subscribe / About).
- [ ] `app/page.tsx` : landing « built by builders » + aperçu dernière édition + form subscribe (Server Action).
- [ ] `app/journal/page.tsx` : archive anté-chrono.
- [ ] `app/journal/[date]/page.tsx` : la une (`intro_md` + carte articles par catégorie). `await params`.
- [ ] `app/journal/[date]/[slug]/page.tsx` : page article. `'use cache'` (publié = immutable jusqu'au prochain build). `await params`.
- [ ] `app/about/page.tsx` : story + explication pipeline.
- [ ] `app/api/subscribe/route.ts` : validation manuelle (regex email), `{ ok: true }` / `{ error }`, statuts HTTP corrects.
- [ ] Composant de rendu markdown : `marked` + sanitization. Aucun `dangerouslySetInnerHTML` non sanitizé.

### Phase 6 — Cron & déploiement

- [ ] `.github/workflows/daily.yml` (cron `0 6 * * *`).
- [ ] `.github/workflows/weekly.yml` (cron `0 7 * * 1`).
- [ ] Secrets GH : `ANTHROPIC_API_KEY`, `DATABASE_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `UNSUBSCRIBE_SECRET`.
- [ ] Deploy Vercel + env vars.
- [ ] Test end-to-end : cron manuel → édition draft → publish → page live.

### Phase 7 — Hebdo (peut suivre le launch)

- [ ] `scripts/weekly.ts` : rescore 7 jours, top 5-8, brief composé depuis `summary`, envoi via `lib/email.ts`.
- [ ] Vérifier merge React Email + HMAC unsubscribe (conflit historique `lib/email.ts`).

---

## 9. Cron & déploiement

Deux workflows GitHub Actions, indépendants. Le site Vercel ne fait que lire.

```yaml
# .github/workflows/daily.yml
name: daily-pipeline
on:
  schedule:
    - cron: '0 6 * * *'      # 06:00 UTC chaque jour
  workflow_dispatch: {}        # déclenchement manuel
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run daily
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

Revalidation : `scripts/publish.ts` (ou `daily.ts` en mode auto-publish) appelle un deploy hook Vercel ou une route de revalidation par tag, pour que les pages `'use cache'` reflètent la nouvelle édition.

---

## 10. Coûts

Bornés (indépendants du trafic). Par jour, config MVP (rôles 1-2, Sonnet partout, enrichissement sélectif) :

| Poste | Coût/jour |
|---|---|
| Collecteurs (HN, GitHub, HF, Reddit, RSS) | $0 |
| Enrichissement web_search sélectif (~10 items) | ~$0.40 |
| Rédaction Sonnet (15-20 articles + intro) | ~$0.90 |
| Hebdo (composé depuis summaries) | ~$0.01 |
| Infra (Neon, Vercel, Resend, GH Actions) | $0 (free tiers) |
| **Total** | **~$1.30/jour ≈ $40/mois** |

Note : c'est plus que mes estimations antérieures à Haiku, parce qu'on a tranché Sonnet partout. C'est délibéré — la qualité est le seul moteur de croissance.

---

## 11. Variables d'environnement

```env
# Anthropic
ANTHROPIC_API_KEY=
# Neon (serveur uniquement, jamais NEXT_PUBLIC_)
DATABASE_URL=
# Resend (hebdo)
RESEND_API_KEY=
RESEND_FROM_EMAIL=
# Unsubscribe HMAC + base URL
UNSUBSCRIBE_SECRET=        # openssl rand -hex 32
NEXT_PUBLIC_SITE_URL=      # https://wwwatch.dev (public, non sensible)
```

Fail fast au démarrage de chaque script si une var requise manque (cf. CONVENTIONS §Variables d'environnement). `.env.example` tenu à jour.

---

## 12. Hors scope MVP (→ `FUTURE.md`)

- Bilingue FR-EN (colonne `lang` prête, préfixe `/en/` non implémenté).
- Twitter/X API, scraping Discord.
- Pages catégorie dédiées, recherche, pagination.
- Auto-publish sans relecture (à activer une fois la qualité prouvée).
- Referral leaderboard, auto-tweet.
- Tier payant / benchmarks propriétaires (Phase 3 monétisation du PDF).

---

## Récap des décisions verrouillées

1. Génération en CLI cron, site en lecture seule. `lib/research.ts` + web_search à la volée **supprimés**.
2. EN-only au MVP, **tout traduire** depuis la VF. Colonne `lang` prête pour le bilingue futur.
3. 5 tables : `subscribers`, `briefs` (existantes) + `editions`, `articles`, `raw_items`.
4. Sources par rôle (découverte / primaire / signal-de-signal / différenciation). Pas de Twitter ni Discord au MVP.
5. Sonnet partout, pas de Haiku. Enrichissement sélectif.
6. Garde-fou qualité + statut `draft`/`published` + relecture humaine au début.
7. UX journal : `/`, `/journal`, `/journal/[date]`, `/journal/[date]/[slug]`, `/about`. Pages publiées en `'use cache'`.
8. Pas d'agent team : flux déterministe, appels LLM discrets.
9. Next **16.0.0** (référentiel), pin exact.
