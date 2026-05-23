# PLAN_8.md — Miroir GitHub auto-généré (README quotidien)

**Version:** 1.0
**Date:** 21 mai 2026
**Portée:** un repo public séparé dont l'arborescence markdown est générée
et poussée chaque matin par `publish.ts`. Canal de diffusion, pas produit.
**À lire avec:** CONVENTIONS.md (priorité), PLAN_8.md (discipline secrets,
le token est concerné).

---

## 0. Principe directeur

Le miroir est un **canal de diffusion en lecture seule**, alimenté par le
pipeline. Il n'est jamais source de vérité, et le site n'en dépend jamais.

**Découplage absolu : le push du miroir ne doit JAMAIS casser la
publication du site.** `publish.ts` publie le site d'abord ; il pousse le
miroir ensuite ; un échec du miroir est loggué et avalé, le run reste un
succès. Si GitHub est down ou le token expiré un matin, le site est publié
quand même, le miroir est juste périmé d'un jour.

Le miroir **renvoie vers le site**, il ne le duplique pas : chaque article
est un résumé + un lien vers `wwwatch.dev/journal/...`. C'est ce qui en
fait un canal d'acquisition, pas un site bis qui se concurrence.

---

## 1. L'arborescence : deux types de docs

```
README.md                       ← racine, vue "maintenant" (FEUILLE + nav)
├─ <intro WWWATCH>              (bloc constant, tagline + lien wwwatch.dev)
├─ ÉDITION DU JOUR
│   ├─ <intro du jour>          → lien vers la page édition du site
│   ├─ <résumé article_1>       → lien vers wwwatch.dev/journal/DATE/slug-1
│   ├─ <résumé article_2>       → lien ...
│   └─ <résumé article_n>       → lien ...
├─ Ce mois-ci    : liste des jours   → liens vers archive/YYYY/MM/DD.md
├─ Cette année   : liste des mois    → liens vers archive/YYYY/MM.md
└─ Années passées: liste des années  → liens vers archive/YYYY.md

archive/2026/05/21.md           ← un JOUR (FEUILLE) : même structure que l'édition du jour
├─ <intro WWWATCH>
├─ <intro du jour>             → lien page édition site
├─ <résumé article_1>          → lien site
├─ <résumé article_n>          → lien site
└─ ↑ remonter : mois · racine

archive/2026/05.md              ← un MOIS : NAVIGATION pure
├─ <intro WWWATCH>
├─ liste des jours du mois     → liens vers les feuilles-jour
└─ ↑ remonter : année · racine

archive/2026.md                 ← une ANNÉE : NAVIGATION pure
├─ <intro WWWATCH>
├─ liste des mois de l'année   → liens vers les docs-mois
└─ ↑ remonter : racine
```

**Deux types, c'est tout :**
- **Feuilles** (README racine + chaque jour) : intro du jour + résumés
  d'articles + liens vers le site. Le contenu.
- **Niveaux intermédiaires** (mois, année) : navigation pure, listes de
  liens. Pas de duplication de contenu.

Note : `archive/2026.md` (fichier) et `archive/2026/` (dossier) coexistent
sans souci, idem `05.md` et `05/`.

---

## 2. D'où vient le contenu

Aucune nouvelle source de données. Tout est dans les tables existantes :

- **Feuille du jour** : `publish.ts` a déjà sous la main l'intro du jour et,
  par article, le `title` éditorial + `summary` + `slug` + `category`. Le
  lien article = `https://wwwatch.dev/journal/{date}/{slug}`.
- **Listes de navigation** (mois → ses jours, année → ses mois, racine →
  jours/mois/années) : une requête légère sur `editions` pour lister les
  dates d'édition publiées. Pas une nouvelle source, juste un `select` des
  dates. Cheap.

---

## 3. Les liens relatifs (LE piège)

Les liens entre fichiers du repo doivent fonctionner dans le rendu markdown
de GitHub, et le bon chemin **dépend de la profondeur du fichier qui émet le
lien**. C'est l'endroit n°1 où on se trompe.

**Règle imposée : utiliser `path.relative(dirname(fromFile), toFile)`**, une
fonction pure `relLink(fromPath, toPath)`, testée sur ces cas :

| De | Vers | Attendu |
|---|---|---|
| `README.md` | `archive/2026/05/21.md` | `archive/2026/05/21.md` |
| `archive/2026/05/21.md` | `archive/2026/05.md` | `../05.md` |
| `archive/2026/05/21.md` | `README.md` | `../../../README.md` |
| `archive/2026/05.md` | `archive/2026/05/21.md` | `05/21.md` |
| `archive/2026.md` | `archive/2026/05.md` | `2026/05.md` |

Les liens vers les **articles du site** sont des URLs absolues
(`https://wwwatch.dev/...`), donc triviales, aucun calcul.

---

## 4. Module de génération `lib/mirror.ts`

- [ ] `lib/mirror.ts` : génère le markdown de chaque type de doc à partir
  des données (fonctions pures côté formatage, testables sans I/O).
  - `renderLeaf(date, dayIntro, articles[])` → markdown feuille.
  - `renderMonth(year, month, dayDates[])` → markdown nav mois.
  - `renderYear(year, monthList[])` → markdown nav année.
  - `renderRoot(today, monthDays[], yearMonths[], allYears[])` → README.
  - `relLink(from, to)` → chemin relatif (cf. §3), pure, testée.
  - `WWWATCH_INTRO` : constante (tagline + lien), réutilisée partout. Pas de
    `—`/`–` (règle ponctuation).
- [ ] **Régénération minimale par publication** : publier le jour J
  régénère seulement la chaîne d'ancêtres, pas tout l'arbre :
  - crée/écrase la feuille `archive/YYYY/MM/DD.md`,
  - régénère le `README.md` racine,
  - régénère le doc mois courant `archive/YYYY/MM.md`,
  - régénère le doc année courante `archive/YYYY.md`.
  Les feuilles des jours passés ne bougent pas. (Les docs mois/année sont
  reconstruits depuis la requête de dates du §2.)

---

## 5. Le push vers le repo miroir

Pas de clone local, pas de working dir : utiliser l'**API GitHub** depuis
`publish.ts`.

- [ ] **Recommandé : Git Data API**, pour un **seul commit propre par jour**
  ("edition YYYY-MM-DD") regroupant les ~4 fichiers modifiés :
  créer les blobs → un tree → un commit → mettre à jour la ref `main`.
- [ ] **Alternative plus simple : Contents API** (`PUT /repos/{owner}/{repo}/
  contents/{path}`), un appel par fichier (GET du SHA courant puis PUT).
  ~4 fichiers/jour = trivial, mais N commits/jour. Acceptable pour un repo
  bot ; choisir selon la tolérance « 1 commit vs N commits ».
- [ ] Reco : Git Data API si le commit unique compte (plus propre dans
  l'historique public) ; sinon Contents API pour la simplicité. Trancher,
  ne pas faire les deux.

---

## 6. Branchement dans `publish.ts`

- [ ] **Après** la publication réussie du site (édition `draft → published`
  validée), appeler la génération + push du miroir.
- [ ] **Tout est dans un `try/catch` qui n'interrompt jamais le run.** En cas
  d'échec : log `[mirror] push failed: <raison>`, puis le run se termine en
  succès. Le miroir périmé d'un jour n'est pas une erreur de pipeline.
- [ ] Respecter `DRY_RUN` : en dry-run, générer le markdown et logguer, ne
  rien pousser.
- [ ] Logs préfixés `[mirror]` : fichiers régénérés, commit SHA poussé.

---

## 7. Le token GitHub (nouveau secret)

- [ ] **Fine-grained PAT scopé au SEUL repo miroir**, permission
  **Contents: Read and write** uniquement. Pas un classic token, pas un
  token org-wide. Périmètre minimal.
- [ ] Stocké en `GITHUB_MIRROR_TOKEN` dans l'env du cron (`.env.local` +
  Vercel), **jamais commité**. Ajouter à `.env.example` (placeholder) et
  fail fast si absent.
- [ ] **Intersection PLAN_8** : ce token vit dans l'env du repo du site. Si
  le repo du site est ouvert un jour, ce token ne doit jamais avoir
  touché l'historique. L'ajouter à l'inventaire des secrets si un plan
  d'ouverture du repo est défini.

---

## 8. Phase 0 — Préparation (toi, pas l'agent)

- [ ] Créer le repo miroir **public** et vide sur GitHub (création de
  repo = toi). Nom au choix, ex `wwwatch-journal`.
- [ ] Générer le fine-grained PAT (§7), le mettre dans l'env du cron.
- [ ] Décider : commit unique (Git Data API) ou N commits (Contents API).

---

## 9. Robustesse / trous

- [ ] **Auto-réparation partielle** : comme README/mois/année sont
  reconstruits depuis la DB à chaque publication, un jour manqué se
  rattrape pour ces docs au prochain run. Seule la **feuille du jour
  manqué** reste absente → le doc mois pointerait vers un fichier inexistant.
- [ ] MVP : accepter ce trou, le logguer. Un mode `--backfill <date>` qui
  régénère une feuille passée depuis la DB est noté en `FUTURE.md` (pas
  MVP).
- [ ] Idempotence : régénérer un jour déjà poussé doit produire le même
  résultat (écrasement propre), pas un doublon.

---

## 10. Toi vs Claude Code

**Toi :** Phase 0 (créer le repo public, le PAT, choisir l'API). C'est tout.

**Claude Code :**
1. `lib/mirror.ts` (rendu + `relLink` testée, §3-4).
2. Push via API GitHub (§5, l'option choisie).
3. Branchement dans `publish.ts` (§6), try/catch découplé, DRY_RUN respecté.
4. `.env.example` + fail fast sur `GITHUB_MIRROR_TOKEN`.
5. Mettre à jour `.env.example` avec le nouveau secret.

**Commit suggéré :** `feat(mirror): generate and push daily readme archive`

**Vérification (dry-run) :** lancer `publish.ts` en `DRY_RUN`, vérifier le
markdown généré : les liens relatifs corrects (tester les 5 cas du §3 dans
le rendu GitHub après un premier push réel), les liens articles en absolu
vers le site, l'intro WWWATCH présente partout, et qu'un échec simulé du
push n'interrompt pas le run.

---

## 11. Hors périmètre / FUTURE

→ Mode `--backfill` pour combler une feuille manquée. → README badges/stats.
→ Index par catégorie ou par tag dans le miroir (cohérent avec les pages
tag du site, plus tard). → Tout ça dans `FUTURE.md`.

---

## Récap

- Repo public séparé, miroir en lecture seule, alimenté par `publish.ts`.
- **Découplé** : un échec du push ne casse jamais la publication du site.
- Deux types de docs : feuilles (jour, avec résumés + liens vers le site) et
  navigation (mois, année).
- Aucune nouvelle donnée : feuille = ce que `publish.ts` a en main ;
  navigation = un `select` des dates d'édition.
- Le piège = les liens relatifs : `path.relative(dirname(from), to)`, testé.
- Push via API GitHub (Git Data pour 1 commit/jour, ou Contents pour la
  simplicité).
- Nouveau secret `GITHUB_MIRROR_TOKEN` : fine-grained PAT, ce repo seul,
  Contents write only.
