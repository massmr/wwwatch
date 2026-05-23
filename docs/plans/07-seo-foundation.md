# PLAN_7.md — Fondation SEO technique (semaine 1)

**Version:** 1.0
**Date:** 21 mai 2026
**Portée:** la fondation technique SEO « semaine 1 » de l'étude SEO, avant
tout trafic public. L'image OG en est la pièce maîtresse.
**À lire avec:** l'étude SEO (artifact), CONVENTIONS.md (priorité en cas de
conflit), PLAN_4.md (prérequis, voir §0).

---

## 0. Prérequis bloquant : le titre éditorial

**Tout ce plan dépend d'un `article.title` éditorial propre.** L'image OG,
le `<title>`, l'Open Graph, le JSON-LD `headline` tirent tous ce champ. Si
le bug de PLAN_4 n'est pas corrigé et vérifié, chaque carte OG affichera
`"ollama/ollama: Get up and running with Kimi-K2.5..."` au lieu du titre
éditorial — et tu auras propagé le bug sur Discover, Twitter et Google.

**Donc : PLAN_4 doit être implémenté et vérifié AVANT ce plan.** Si ce
n'est pas fait, arrête-toi et fais PLAN_4 d'abord. Ce n'est pas optionnel.

---

## 1. Le système d'images OG (pièce maîtresse)

### Principe

Pas « une image », un **système** qui génère une carte typographique
excellente automatiquement pour chaque article, sans intervention. Rendu
serveur via la convention Next.js `opengraph-image.tsx` + `next/og`.
Gratuit, légal (tous les éléments t'appartiennent), déterministe, on-brand.

**Pourquoi pas d'IA générative ni d'image source :** une illustration IA
générique (cerveau lumineux, dégradé violet) est le signal visuel du
contenu IA à la chaîne, ce qui aggrave le risque de l'axe 3 de l'étude.
Les images de la source (CNBC, GitHub) sont sous copyright et sans valeur.
La carte typo est le seul choix qui sert la marque sans créer de risque.

### Design (verrouillé, hex ajustables)

Canevas **1200×630** (satisfait OG ratio 1.91:1 et minimum Discover 1200px).

- **Fond** near-black `#0C0E12`, texte blanc cassé `#ECECEC`. Une carte
  sombre ressort dans les feeds clairs de Discover/Twitter.
- **Titre éditorial** au centre-bas : grotesque (Geist/Inter), gras, ~64px,
  interligne serré, 3 lignes max, troncature propre au-delà. C'est le
  contenu visuel principal. Doit rester lisible à 300px de large.
- **Métadonnées en monospace** (Geist Mono / JetBrains Mono) :
  - haut gauche : wordmark `wwwatch`
  - haut droite : label de catégorie, majuscules, dans la couleur d'accent
  - bas : date + `wwwatch.dev`, en mono atténué
- **Accent par catégorie** : seul élément qui varie (label + filet fin sous
  le titre). Canevas/typo/grille constants → feed varié, identité
  reconnaissable. L'accent ne sert qu'en petites touches (label + filet) :
  le titre reste blanc cassé, le fond reste noir, donc l'identité « carte
  wwwatch » domine toujours. Palette VALIDÉE (toutes désaturées au même
  niveau pour rester sobres ; sémantique là où elle existe) :

  | Catégorie | Accent | Hex |
  |---|---|---|
  | `coding_agent` | vert primaire marque | `#4ADE80` |
  | `framework` | cyan | `#22D3EE` |
  | `infra_api` | teal | `#2DD4BF` |
  | `research` | indigo (PAS violet : signal « slop IA » évité) | `#818CF8` |
  | `tool` | ardoise clair (fourre-tout = accent le plus neutre) | `#94A3B8` |
  | `funding` | émeraude (argent = vert) | `#34D399` |
  | `security` | ambre (alerte sans rouge agressif) | `#FBBF24` |
  | `eval` | bleu (mesure, données) | `#60A5FA` |
  | `ops` | orange (opérationnel) | `#FB923C` |

  Note : `coding_agent` et `funding` sont les deux teintes les plus
  proches (vert vif vs émeraude). Distinguables côte à côte ; rarement les
  deux catégories dominantes le même jour. Assumé pour garder la sémantique
  vert = argent.
- **Zéro** illustration, dégradé mesh, icône déco. Typo, couleur, vide.

### Implémentation

- [ ] `app/journal/[date]/[slug]/opengraph-image.tsx` : génère la carte via
  `ImageResponse` (`next/og`) à partir du titre éditorial + catégorie de
  l'article. Next câble automatiquement `og:image` et `twitter:image`.
- [ ] Charger les polices (Geist + Geist Mono) en `fetch` ArrayBuffer dans
  la route (next/og ne lit pas les polices système). Les committer en
  `public/fonts/` ou les charger depuis le package.
- [ ] Un seul template paramétré par `category` (map catégorie → accent).
  Fonction pure `accentForCategory(cat)` testable isolément.
- [ ] `size = { width: 1200, height: 630 }`, `contentType = 'image/png'`.
- [ ] Troncature du titre côté template (3 lignes), pas de débordement.
- [ ] Reproduire la même carte pour les pages d'édition
  `app/journal/[date]/opengraph-image.tsx` (titre = « wwwatch · [date] »,
  accent neutre).
- [ ] Image OG par défaut pour `/` et `/about` (`app/opengraph-image.tsx`).

### Rappel ponctuation

Le titre vient de `article.title` qui suit déjà la règle anti-tiret. Ne pas
réintroduire de `—`/`–` dans les labels ou le template.

---

## 2. Métadonnées par page (`generateMetadata`)

`generateMetadata` sur **chaque** route. Pour `/journal/[date]/[slug]` :

- [ ] `title` = titre éditorial (jamais le titre source brut — cf. §0).
- [ ] `description` = résumé éditorial, 150-160 caractères.
- [ ] `openGraph` : `title`, `description`, `type: 'article'`,
  `publishedTime`, `modifiedTime`, `authors`, `section` (catégorie).
  (Les `images` sont câblées automatiquement par `opengraph-image.tsx`.)
- [ ] `twitter` : `card: 'summary_large_image'`.
- [ ] `alternates.canonical` = URL durable de l'article (self-canonical).
- [ ] `robots: { 'max-image-preview': 'large' }` — débloque les grandes
  cartes Discover. **Vérifier l'absence de `notranslate` /
  `nopagereadaloud`** (disqualifiants Discover).

**Invariant à tenir :** `openGraph.title` = `metadata.title` = `<h1>` =
`headline` JSON-LD. Tout désalignement brouille le ranking Discover.

Pour `/journal/[date]` (édition) : même schéma, `description` qui résume
l'édition. Pour `/`, `/about`, `/journal` : métadonnées statiques propres
(et c'est là qu'on règle enfin builders vs product engineers — voir §9).

---

## 3. Données structurées (JSON-LD)

- [ ] **`NewsArticle`** sur les pages article (pas `Article` : le contenu
  est daté, NewsArticle débloque l'éligibilité Top Stories). Champs :
  `headline` (≤110 car, = titre éditorial), `image` (l'OG 1200×630),
  `datePublished` (ISO 8601 + timezone), `dateModified` (uniquement si
  édition réelle — pas de faux refresh), `author` (Person + `url` vers la
  page profil), `publisher` (Organization wwwatch + logo), `articleSection`
  (catégorie).
- [ ] **`BreadcrumbList`** sur article et édition : Home > Journal > [date]
  > [titre].
- [ ] **`NewsMediaOrganization`** + **`WebSite`** (avec `SearchAction` pour
  la Sitelinks Searchbox) sur `/` et `/about`. `sameAs` vers les profils
  sociaux.
- [ ] Injecter via `<script type="application/ld+json">` dans le server
  component. Plusieurs blocs OK.
- [ ] Valider les 5 premiers articles au Rich Results Test de Google.

---

## 4. Sitemaps

- [ ] **`app/sitemap.ts`** : toutes les URLs du journal (articles,
  éditions, `/`, `/about`). `generateSitemaps()` pour chunker par mois.
  `lastModified` = vraie date de modif (jamais artificielle ; Google s'y
  fie quand c'est fiable). Ignorer `priority`/`changefreq`.
- [ ] **`app/news-sitemap.xml/route.ts`** (Route Handler, le sitemap.ts
  natif ne supporte pas l'extension `<news:news>`) : XML avec
  `xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"`,
  **uniquement les articles des dernières 48h**, retirés au-delà.
  `Content-Type: application/xml`.
- [ ] **Régénération à la publication** : `revalidateTag('news-sitemap')`
  déclenché par `publish.ts`, + fallback de revalidation 1h. (Connecte au
  point cache non résolu : c'est `publish.ts` qui invalide.)
- [ ] Référencer les deux sitemaps dans `robots.ts` et les soumettre
  séparément dans Search Console.

---

## 5. robots.ts

- [ ] **`app/robots.ts`** : autoriser tous les user-agents par défaut,
  interdire `/api/*`. Inclure les lignes `Sitemap:` pour `/sitemap.xml` et
  `/news-sitemap.xml`.

---

## 6. IndexNow (Bing/Yandex, pas Google)

- [ ] Générer une clé IndexNow, déposer le fichier `{key}.txt` à la racine
  (`public/`).
- [ ] **Ping à chaque publication** depuis `publish.ts` : POST des URLs
  publiées à l'API IndexNow. Gratuit, faible risque, fort levier (17% des
  clics Bing passent par IndexNow). Pas de flush nécessaire (fire and
  forget avec log).

---

## 7. Vérification `'use cache'`

- [ ] Confirmer que **toutes** les pages `/journal/**` portent `'use cache'`
  avec un `cacheLife` adapté : `'max'` pour les éditions passées
  (immuables), `'hours'` pour l'édition du jour (la surface la plus
  crawlée doit rester fraîche).
- [ ] **Check au build** : vérifier que les pages article/édition sont bien
  prérendues statiques (`✓ Generating static pages`). Un composant enfant
  qui touche `cookies()`/`headers()`/`searchParams` sans isolation rend la
  page dynamique par accident — et en prod ça ne fait que logguer, pas
  planter. Ajouter ce check à la CI si possible.
- [ ] Smoke-test : `curl` une page article → le corps complet doit être
  dans le HTML initial (pas hydraté côté client).

---

## 8. About + bylines (E-E-A-T)

L'About copy est déjà rédigé (Option C, pipeline transparent). Ce plan
ajoute la dimension **autorité** que l'étude juge critique pour un site de
news IA :

- [ ] **Byline nommée sur chaque article : wwwatch.** Le
  rédacteur LLM écrit, maintainer relit et publie → la byline est maintainer
  maintainer. (Décidé : signature au nom réel, pas « wwwatch staff ». Note
  d'exposition : wwwatch devient publiquement « le projet de maintainer
  maintainer », ce qui lie le projet à son nom — choix assumé.)
- [ ] **Page profil auteur** (`/author/wwwatch` ou similaire) :
  bio, photo, `sameAs` vers LinkedIn/GitHub/Twitter (désambiguïsation
  d'entité Google). Liée depuis chaque article via le champ `author` du
  JSON-LD (`Person`, avec `url` vers cette page et `image` = la photo).
- [ ] **Photo de profil : vraie photo, pas un avatar.** Minimum 1200px de
  large, carrée, bien éclairée, fond neutre (pas un crop de selfie). C'est
  la même image qui sert de `image` dans le JSON-LD `Person` et de signal
  d'entité pour Google. Fournie par maintainer, déposée en `public/`.
- [ ] **Engagement public du plafond 6-8/jour** sur l'About (moat éditorial
  vis-à-vis de la policy Google).
- [ ] Vérifier que l'About décrit le pipeline et la relecture humaine
  (déjà le cas dans le copy validé).

---

## 9. Réglages de cohérence à intégrer au passage (légitimes ici)

Ces points traînaient ; le sprint SEO est le bon moment, car ils touchent
title/meta :

- [ ] **builders vs product engineers** : trancher un terme unique et
  l'appliquer au `<title>`/meta de `/` (et partout où l'incohérence
  subsiste). À décider avec une intention SEO : quel terme les gens tapent.
  Reco par défaut : « builders » (cohérent hero/footer), mais à valider.

---

## 10. Toi vs Claude Code

**Toi (hors code) :**
- Vérifier que PLAN_4 (titre éditorial) est fait — prérequis bloquant.
- Trancher le terme builders/product engineers (§9). (Palette et byline :
  faits.)
- Fournir la photo de profil (vraie photo, 1200px+, carrée, fond neutre).
- Jour du lancement : vérifier le domaine dans Google Search Console + Bing
  Webmaster Tools, soumettre les deux sitemaps, vérifier le Rich Results
  Test. (Création de comptes = toi, pas l'agent.)

**Claude Code :** §1 à §9, dans cet ordre de dépendance :
1. §0 d'abord (vérifier PLAN_4).
2. §1 image OG (dépend du titre éditorial).
3. §2 métadonnées + §3 JSON-LD (même dépendance, à faire ensemble).
4. §4 sitemaps + §5 robots + §6 IndexNow (le bloc indexation).
5. §7 vérification cache.
6. §8 bylines + profil auteur.
7. §9 cohérence des termes.

**Découpage commits suggéré** (pas un seul commit, c'est trop) :
`feat(seo): og image system`, `feat(seo): per-page metadata and json-ld`,
`feat(seo): sitemaps, robots, indexnow`, `chore(seo): verify static
caching`, `feat(seo): author bylines and profile`,
`chore(copy): unify builder terminology`.

---

## 11. Hors périmètre semaine 1 (plus tard)

→ Pages catégorie + tag (semaines 2-4 de l'étude). → Articles evergreen
how-to (mois 1). → Soumissions HN/Reddit. → Outreach backlinks. → Google
News Showcase (mois 6+). Tout ça dans `FUTURE.md` ou un PLAN ultérieur.

---

## Récap

- **Prérequis bloquant** : titre éditorial propre (PLAN_4). Sans lui, tout
  le reste propage le bug sur Discover/Twitter/Google.
- **Image OG** = carte typographique sombre générée par `next/og`, titre =
  l'image, accent par catégorie, zéro illustration. Pièce maîtresse.
- Métadonnées + JSON-LD `NewsArticle` alignés sur le titre éditorial.
- Sitemap + news-sitemap (48h, régénéré au publish) + robots + IndexNow.
- `'use cache'` vérifié statique au build.
- Bylines nommées + profil auteur pour l'E-E-A-T.
- On règle builders/product engineers au passage (c'est du title/meta).
- Découper en ~6 commits, pas un seul.
