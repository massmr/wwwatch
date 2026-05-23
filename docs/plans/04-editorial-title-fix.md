# PLAN_4.md — Fix du titre éditorial

**Version:** 1.0
**Date:** 21 mai 2026
**Portée:** correctif ciblé, pas un nouveau chantier
**À lire avec:** PLAN_3.md (étapes 4-5) et CONVENTIONS.md (priorité en cas de conflit)

---

## 1. Le symptôme observé

Sur `wwwatch.dev`, le `<title>` HTML, le `<h1>` et les titres de lien du
sommaire (home + `/journal/[date]`) affichent la **description brute du
repo source**, pas le titre éditorial.

Exemple vérifié (page Ollama du 21 mai) :

| Champ | Valeur en ligne | Devrait être |
|---|---|---|
| `<title>` | `ollama/ollama: Get up and running with Kimi-K2.5, GLM-5, MiniMax…` | titre éditorial |
| `<h1>` | idem (description repo) | titre éditorial |
| 1er `##` du corps | `Ollama 0.24 Brings the Codex App to Your Local Machine` | — |
| corps complet | **propre** (K2.6, GLM-5.1, sources citées) | inchangé |

Le constat clé : **le bon titre éditorial existe déjà** — il est présent
comme premier heading *dans* le `body_md`. Il est juste affiché au mauvais
endroit, et le mauvais texte (la description GitHub, qui contient les
fantômes « K2.5 / MiniMax ») occupe le champ titre.

**Le contenu n'est pas en cause. Le writer fonctionne.** C'est la
séparation `title` / `body_md` et le rendu qui sont cassés.

---

## 2. Pourquoi c'est prioritaire

Petit visuellement, coûteux stratégiquement :

1. **SEO.** Le `<title>` est le signal #1 pour Google. Indexer
   `"ollama/ollama: Get up and running with…"` au lieu du titre éditorial
   gâche le bénéfice SEO de chaque page — or le SEO est le cœur de la thèse
   de croissance.
2. **Premier contact.** Home, onglet navigateur, et Open Graph (partage
   social) tirent ce même champ. Un lecteur voit « K2.5 / MiniMax » avant
   même le corps propre. En niche, cette impression de péremption coûte la
   crédibilité.
3. **Régression déguisée.** C'est le même symptôme visible que le bug
   d'hallucination déjà « corrigé » — mais une cause différente : avant le
   writer inventait, ici le rendu pioche le mauvais champ. À traiter pour
   ne pas croire le problème revenu.

---

## 3. Cause racine — à confirmer avant de coder

Deux hypothèses. **Ne pas présumer : vérifier en DB d'abord** (Phase 1).

**Hypothèse A — bug de pipeline (la plus probable).** Le writer produit le
titre éditorial *dans* le `body_md` (premier `##`), mais le champ
`articles.title` est rempli par défaut avec `raw_item.title` /
`raw_item.description`. Donc :
- `articles.title` ← description repo brute (faux)
- `articles.body_md` ← contient le vrai titre + contenu propre

Indice fort en faveur de A : le vrai titre apparaît comme `##` dans le
corps. Le writer ne sépare pas proprement `title` et `body_md`.

**Hypothèse B — bug de rendu seul.** Le bon `title` est en DB mais le
composant de page lit `raw_item.title` (ou un mauvais champ) pour le
`<title>` / `<h1>` / liens.

La distinction change l'ampleur du fix : A impose de corriger writer +
stockage + rendu + backfill ; B ne touche que le rendu. **L'évidence
penche vers A**, donc le plan le traite, mais Phase 1 tranche.

---

## 4. Le correctif

### Phase 1 — Confirmer la cause (15 min, aucune écriture)

```sql
select day, slug, title, left(body_md, 120) as body_start
from articles
where day = '2026-05-21' and slug = 'ollama-0-24-codex-app-local-desktop-agent';
```

- Si `title` = description repo brute **et** `body_start` commence par le
  vrai titre en `##` → **Hypothèse A confirmée**. Faire toutes les phases.
- Si `title` = titre éditorial propre → **Hypothèse B**. Sauter en Phase 4
  (rendu) uniquement.

Noter le résultat en commentaire de PR avant de continuer.

### Phase 2 — Contrat de sortie du writer (`lib/writer.ts`)

Le writer doit émettre une **structure explicite**, titre **hors** du
corps :

```ts
type GeneratedArticle = {
  title: string;       // titre éditorial, une ligne, SANS markdown heading
  summary: string;     // 1-2 lignes
  category: ArticleCategory;
  body_md: string;     // corps SANS le titre en tête (pas de '# ' / '## ' initial)
};
```

Règles :
- Le prompt demande explicitement un champ `title` séparé (sortie JSON
  structurée, ou balises claires que l'on parse — cf. CONVENTIONS §Appels
  LLM : sortie LLM = donnée non fiable, parser défensivement).
- **Le `body_md` ne commence JAMAIS par un heading titre.** S'il en
  contient un en première ligne, le supprimer au parsing (le titre vit
  dans `title`, pas dans le corps — sinon double titre à l'écran une fois
  le rendu corrigé).
- **Interdiction de retomber sur `raw_item.title` / `description`** comme
  valeur de `title`. Si le writer ne produit pas de titre exploitable,
  l'article part en `draft` avec flag (voir Phase 5), il n'est pas publié
  avec un titre brut.

### Phase 3 — Stockage (`lib/db.ts`, étape 6 du pipeline)

- `articles.title` ← **uniquement** `GeneratedArticle.title`. Jamais de
  fallback silencieux sur la source.
- Si `title` est vide/absent → ne pas insérer en `published` ; insérer en
  `draft` + log `[store] missing editorial title for <slug>`.

### Phase 4 — Rendu (`app/**`)

Tous ces points d'affichage lisent **`article.title` éditorial**, jamais
`raw_item.title` / `description` :

- `<title>` de la page article et de la page édition.
- `<h1>` de la page article.
- Titres de lien du sommaire (home `app/page.tsx` + `/journal/[date]`).
- **Open Graph / Twitter Card** (`og:title`, `twitter:title`) — sinon le
  partage social ressort le mauvais titre.
- Le corps rend `body_md` **sans** re-afficher le titre (cf. Phase 2 : le
  titre n'est plus dans le corps).

Vérifier qu'aucun composant ne lit la table `raw_items` pour de
l'affichage. Le rendu ne lit que `editions` et `articles`.

### Phase 5 — Garde-fou QA (`lib/editor.ts`, étape 5 du pipeline)

Ajouter un contrôle :

- **`title` non éditorialisé** : si `article.title` est égal ou très
  proche de la `description` / `title` de la source (`raw_item`), flag
  « non-editorialized title » → `draft`. C'est exactement le signal du
  bug : un titre qui matche la source n'a pas été rédigé.
- Rappel des contrôles existants (PLAN_3 étape 5) : détail factuel non
  traçable, doublon sémantique, < 200 mots, sans source.

### Phase 6 — Backfill de l'existant

L'édition du 21 mai (et toute édition antérieure au fix) a des `title`
sales en DB. Deux options, choisir selon le volume :

- **Peu d'éditions (cas actuel)** : régénérer ces éditions avec le writer
  corrigé. Plus propre — on récupère un vrai `title` rédigé.
- **Sinon** : migration `neon/0003_backfill_titles.sql` qui extrait le
  premier `##` du `body_md` vers `title` et le retire du corps. Plus
  rapide mais conserve un titre « tel que le writer l'avait enfoui »,
  potentiellement moins soigné.

Reco : **régénérer**, le volume est trivial et la qualité prime.

---

## 5. Vérification (definition of done)

1. `select title from articles where day='2026-05-21'` → tous des titres
   éditoriaux, aucun ne commence par `owner/repo:` ni ne contient
   « K2.5 / MiniMax ».
2. Page article : `<title>`, `<h1>`, corps cohérents, **un seul** titre à
   l'écran (pas de doublon).
3. Home + `/journal/[date]` : titres de lien = titres éditoriaux.
4. `og:title` correct (vérifier le `<head>` ou un validateur OG).
5. Hard refresh (cache `'use cache'` invalidé par `publish.ts`) : le live
   reflète la DB corrigée. Si le live reste sale après régénération → le
   vrai sujet résiduel est l'**invalidation de cache**, à traiter à part
   (cf. PLAN_3 §9, revalidation déclenchée par publish).

---

## 6. Synchronisation des autres docs

Une fois le fix validé sur un dry-run :

- **PLAN_3.md étape 4** : intégrer le contrat `GeneratedArticle` (titre
  séparé, hors corps, pas de fallback source).
- **PLAN_3.md étape 5** : ajouter le contrôle « titre non éditorialisé ».
- **CONVENTIONS.md §Pipeline** : ajouter une règle « le rendu ne lit que
  `editions`/`articles`, jamais `raw_items` ; `articles.title` n'a jamais
  pour valeur par défaut un champ de la source ».

Ne figer dans PLAN_3 / CONVENTIONS qu'**après** avoir vu une édition
propre de bout en bout — même principe que pour les correctifs v3.1 : on
ne grave que ce qu'on a vérifié.

---

## Récap

- Bug = mauvais champ affiché (`title` ← description repo brute), **pas**
  un problème de contenu. Le corps est propre.
- Cause probable = writer qui enfouit le titre dans `body_md` + stockage
  qui retombe sur la source. À **confirmer en Phase 1**.
- Fix = titre structuré hors corps (writer) + pas de fallback (stockage) +
  rendu qui lit `article.title` partout, OG inclus + QA qui flague un
  titre = source + régénération de l'existant.
- Enjeu réel = SEO + premier contact, pas cosmétique.
