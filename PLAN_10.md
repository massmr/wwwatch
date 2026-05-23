# PLAN_10.md — Cleanup repo avant publication open source

**Version :** 1.0
**Date :** 23 mai 2026
**Portée :** auditer et nettoyer le repo `wwwatch` pour une publication
publique sur GitHub. Sécurité d'abord (secrets, fuites, history), puis
qualité (conventions, code mort, docs publiques manquantes).
**À lire avec :** CONVENTIONS.md (priorité en cas de conflit).

---

## 1. Objectif & non-objectifs

**Objectif.** Le repo `wwwatch` doit pouvoir être rendu public sans :
- exposer un secret (clé API, token, secret HMAC, identifiant de
  compte cloud) — actuel ou passé dans l'historique ;
- exposer du contenu interne non destiné au public (notes Claude Code,
  mémoire agent, drafts dans `out/`) ;
- exposer des décisions internes non documentées (PLAN\_\*.md sont OK en
  archive, mais doivent être triés et clairement étiquetés "historique").

**Non-objectifs.**
- Refactor du code applicatif. Si une règle CONVENTIONS est cassée, on
  fixe. Sinon on ne touche pas.
- Bump majeur des dépendances (`@anthropic-ai/sdk` 0.30 → 0.98,
  `resend` 4 → 6, `marked` 15 → 18). À faire dans un plan dédié, hors
  scope OSS.
- Migration de branding (le nom du domaine, l'auteur, etc. restent ce
  qu'ils sont — voir §6 pour les décisions personnelles à valider).

---

## 2. Audit sécurité

### 2.1 Secrets et variables d'env

État actuel :
- `.env.local` existe sur disque (1466 octets), gitignored (`.gitignore`
  l3-5). Pas dans l'historique d'après `git log -- .env.local`.
- `.env.example` documente les 11 vars : `ANTHROPIC_API_KEY`,
  `DATABASE_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`,
  `RESEND_FROM_WELCOME`, `UNSUBSCRIBE_SECRET`, `NEXT_PUBLIC_SITE_URL`,
  `VERCEL_DEPLOY_HOOK_URL`, `GITHUB_MIRROR_TOKEN`, `GITHUB_MIRROR_REPO`,
  `INDEXNOW_KEY`, `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`,
  `NEXT_PUBLIC_POSTHOG_HOST`. Bon état.

À faire :
- [ ] Scan complet de l'historique avec un outil dédié, **pas un grep
  artisanal** : `gitleaks detect --source . --log-opts="--all"` (ou
  `trufflehog git file://. --since-commit=$(git rev-list --max-parents=0 HEAD)`).
- [ ] Si une fuite est trouvée : décider rewrite (`git filter-repo`) **ou**
  publication en partant d'un commit orphelin (§7).
- [ ] Vérifier que `.env`, `.env.local`, `.env.*.local` sont bien dans
  `.gitignore` (OK aujourd'hui, le confirmer).
- [ ] Ajouter `.env.production`, `.env.development.local` au gitignore
  par prudence (Next.js peut les générer).

### 2.2 Secrets à rotater avant publication

Même si rien n'a fuité dans l'historique, certains identifiants sont
inscrits *par nature* dans le code public et doivent être considérés
comme à rotater au moment du push :

- [ ] **`INDEXNOW_KEY`** : présent en clair dans le nom du fichier
  `public/REDACTED_INDEXNOW_KEY.txt` ET dans `.env.example`
  (l31). C'est un identifiant public par design (IndexNow), mais autant
  ne pas figer la valeur de prod dans un repo public. Générer une
  nouvelle clé, renommer le fichier, mettre à jour `.env.local` côté
  prod. Mettre `INDEXNOW_KEY=change-me-32-hex-chars` dans `.env.example`.
- [ ] **`VERCEL_DEPLOY_HOOK_URL`** : URL contenant un token. Aujourd'hui
  l'exemple est tronqué (l21). OK. Vérifier qu'aucun commit n'a la valeur
  complète.
- [ ] **`UNSUBSCRIBE_SECRET`** : aucune valeur en clair n'est commit.
  L'exemple dit `change-me-32-chars-minimum`. OK.

### 2.3 npm audit

```
2 moderate vulnerabilities
  postcss < 8.5.10  (XSS via Unescaped </style>)
  next   9.3.4-canary.0 - 16.3.0-canary.5  (via postcss)
```

- [ ] `npm audit` est attendu pour rester à 2 modérés tant que Next
  n'a pas bumpé sa dep `postcss`. Documenter dans README §"Security" :
  "tracked upstream, depends on Next.js dependency bump".
- [ ] Ne **pas** lancer `npm audit fix --force` : downgrade vers
  `next@9.3.3`, cassant.
- [ ] Ouvrir un follow-up `// FUTURE:` dans `package.json` (commentaire
  JSON5 impossible — utiliser `FUTURE.md`).

### 2.4 Surface attaque applicative (quick re-check)

CONVENTIONS §API routes et §Appels LLM couvrent déjà :
- [x] `dangerouslySetInnerHTML` : 8 occurrences, toutes sur du JSON-LD
  généré côté serveur ou du markdown LLM **sanitizé via `marked` +
  `sanitize-html`** (voir `app/journal/[date]/[slug]/page.tsx:96`). OK.
- [x] Pas de SQL concaténé : Neon SDK paramétrise. OK.
- [x] Pas de `process.env.X!` (non-null assertion) côté code applicatif
  — fail-fast via `throw` à l'init quand requis.
- [x] CORS : laissé au défaut Next (same-origin). OK pour un MVP fermé.

À vérifier explicitement pendant le cleanup :
- [ ] `app/api/subscribe/route.ts` : validation regex email, longueur
  bornée, pas d'echo de l'erreur DB brute (CONVENTIONS §API règle 4).
- [ ] `app/unsubscribe/page.tsx` : vérifier que la signature HMAC est
  validée **avant** tout side-effect (delete subscriber).
- [ ] Aucune route publique ne lit un secret côté client.

### 2.5 Rate limiting & abus

- [ ] `app/api/subscribe` : aucun rate limit aujourd'hui. Pour un repo
  public, l'URL prod sera connue → risque d'abus trivial. Soit
  documenter (README §"Operations") qu'il n'y en a pas et que c'est
  intentionnel MVP, soit ajouter une limite par IP en `proxy.ts` (Next 16).
  **Décision MVP** : documenter, ne pas implémenter (CONVENTIONS §1 règle 6,
  "pas de gold plating"). Ajouter à `FUTURE.md`.

---

## 3. Audit qualité code

### 3.1 État actuel (déjà bon)

- `: any` typages : **0** dans le code (un seul match est une string
  dans un commentaire). Conforme CONVENTIONS §TypeScript.
- `@ts-ignore` / `@ts-expect-error` : **0**.
- `TODO` : 2, datés et nommés (CONVENTIONS §Commentaires) — laisser :
  - `scripts/publish.ts:112` — `TODO(maintainer, 2026-06-01)` (deploy hook)
  - `lib/collectors/rss.ts:22` — `TODO(maintainer, 2026-06-15)` (RSS URLs)
- `FIXME` : 0. OK.
- `FUTURE` : 1 (`next.config.ts:8`). OK.

### 3.2 À vérifier pendant le cleanup

- [ ] `console.*` (134 occurrences) — la majorité préfixées `[module]`
  comme attendu. Faire une passe rapide pour s'assurer qu'aucun
  `console.log('here')` ou `console.log(JSON.stringify(payload))` ne
  fuit de la PII (emails, tokens, body de requête abonnés).
- [ ] Pas de `useEffect` pour fetch — `grep -n "useEffect" -r app/`
  doit ne renvoyer que des cas légitimes (PostHog pageview).
- [ ] Pas de `@import` SCSS — `grep -n "@import" -r app/` doit être vide
  (CONVENTIONS §SCSS).
- [ ] Pas de couleur/spacing hardcodés dans les `.module.scss`. Spot
  check 3 fichiers au hasard.
- [ ] `package.json` engines : `node >=20` — Vercel runtime par défaut
  est Node.js 24 LTS. Bumper l'engine à `>=20` reste correct mais
  préciser `<=24` dans le README ne sert à rien. Laisser.

### 3.3 Conformité CONVENTIONS §Pipeline

Re-confirmer (déjà OK d'après PLAN_3, mais le repo va être lu par des
inconnus) :
- [ ] Aucun import `@anthropic-ai/sdk` dans `app/**` (CONVENTIONS
  §Pipeline règle 2).
- [ ] `lib/research.ts` n'existe pas / n'a pas été ressuscité.
- [ ] Modèle Anthropic = `claude-sonnet-4-6` partout dans `scripts/` et
  `lib/writer.ts`, `lib/enrich.ts` (CONVENTIONS §Appels LLM).

---

## 4. Fichiers à exclure de l'open source

Le repo contient des artefacts internes que la publication ne doit pas
embarquer.

### 4.1 À gitignorer + retirer du suivi

- [ ] `memory/` (et `memory/project_state.md`) — mémoire d'agent Claude,
  pas une doc publique. `git rm -r --cached memory/` + ajouter au
  `.gitignore`.
- [ ] `out/` — déjà gitignored mais le dossier existe localement avec
  des brouillons (`2026-05-20.md`, `2026-05-21.md`). Laisser tel quel
  (non commité).

### 4.2 À décider : artefacts Claude Code

- [ ] `.claude/agents/code-reviewer.md` — utile pour les contributeurs
  qui utilisent Claude Code. **Garder**, mais le mentionner dans le
  README §"Developer tooling".
- [ ] `.claude/skills/neon-postgres/SKILL.md` — idem.
- [ ] `.agents/skills/neon-postgres/SKILL.md` — duplique le précédent.
  **Décision** : supprimer (préférer `.claude/`).
- [ ] `skills-lock.json` — fichier Claude Code. Garder, marquer comme
  géré par l'outil dans le README.

### 4.3 PLAN\_\*.md — décision

Il y a 10 fichiers PLAN\_\*.md (3683 lignes au total). Trois options :

A. **Garder tels quels à la racine** : transparence totale sur la
   construction du projet. Risque : bruit pour quelqu'un qui veut
   contribuer.
B. **Déplacer dans `docs/plans/`** : range, sans rien perdre. README
   pointe vers le dossier.
C. **Supprimer**, garder uniquement CONVENTIONS.md + un CHANGELOG.

**Recommandation : B.** `docs/plans/` documente l'historique de design,
utile à un lecteur curieux, sans polluer la racine. Renommer
`PLAN_5_PROMPT.md` → `docs/plans/05-writer-prompt.md` pour cohérence.
CLAUDE.md (à la racine) mis à jour pour pointer sur les nouveaux
chemins.

### 4.4 `.env.local`

- [ ] Doit rester **sur disque** (le dev en a besoin) mais **non commité**
  (déjà OK). Vérifier qu'il n'apparaît dans aucun commit
  (cf. §2.1).

---

## 5. Documentation publique manquante

### 5.1 README.md (le fichier est vide aujourd'hui)

Sections minimales (anonyme — pas de "built by X") :
1. **What** : "wwwatch is a daily journal of AI builder news,
   generated by a deterministic pipeline." Une ligne, pas de jargon.
2. **How it works** : schéma ASCII en 4 lignes (collect → score →
   enrich → write → store → render). Lien vers `docs/plans/`.
3. **Stack** : Next.js 16 (App Router), Neon Postgres, Anthropic
   (Sonnet 4.6), Resend, PostHog, GitHub Actions.
4. **Local dev** : `git clone`, `npm install`, `cp .env.example
   .env.local`, remplir les clés, `npm run dev`.
5. **Running the pipeline locally** : `npm run daily:dry`,
   `npm run weekly:dry`.
6. **Deploy** : Vercel + GH Actions (lien vers `.github/workflows/`).
7. **Security** : pointer vers `SECURITY.md`.
8. **License** : MIT.
9. **Contributing** : "Issues and PRs welcome. Read `CONVENTIONS.md`
   before contributing."

Style : pas de marketing, ton builder-to-builder (cohérent avec
`lib/prompt.ts`). Pas d'emoji. **Aucune mention d'auteur, de mainteneur
nommé, ni d'email perso.**

### 5.2 SECURITY.md

Une page courte. **Pas d'email perso.** Deux choix :
- A. Adresse dédiée `security@wwwatch.dev` (créer l'alias avant
  publication).
- B. Renvoyer vers **GitHub Private Vulnerability Reporting** (activé
  par défaut sur les repos publics). Pas d'email à exposer.

**Décision verrouillée : B.** Pas d'adresse à maintenir, pas de fuite
de domaine email. Le fichier dit : "Report via GitHub Security
Advisories on this repo." + scope (prod wwwatch.dev + code) + SLA
best-effort.

### 5.3 LICENSE

- [x] **Décidé : MIT.**
- [ ] Fichier `LICENSE` à la racine. Titulaire du copyright : `wwwatch
  contributors` (pas de nom propre — cf. §6). Année : 2026.

### 5.4 CONTRIBUTING.md (optionnel)

Court : pointer sur `CONVENTIONS.md` pour le style, indiquer que les PRs
doivent passer `npm run build` et que la cible déploiement est `main`.

### 5.5 CODE_OF_CONDUCT.md

Optionnel pour un projet solo. **Skip** au MVP.

### 5.6 CHANGELOG.md

Optionnel. **Skip** au MVP — l'historique des commits suffit.

---

## 6. Scrub des références personnelles

**Décision verrouillée : zéro référence personnelle dans le repo
public** (ni nom, ni email, ni photo, ni handle).

### 6.1 Remplacement du modèle "auteur Personne"

`schema.org/NewsArticle` accepte un `author` de type `Organization`. On
bascule donc tout l'authoring depuis "wwwatch (Person)" vers
"wwwatch (NewsMediaOrganization)". Conséquence : plus de page `/author`,
plus de byline sur les articles, plus de JSON-LD Person.

### 6.2 Fichiers et lignes à modifier

Code applicatif :

- [ ] `app/author/wwwatch/` — **supprimer le dossier entier**
  (`page.tsx`, `page.module.scss`).
- [ ] `app/layout.tsx:76` — retirer le `<Link href="/author/...">`
  dans le footer. Aérer la liste de liens en conséquence.
- [ ] `app/journal/[date]/[slug]/page.tsx`
  - l26 : `authors: [{ name: 'wwwatch', url: ... }]` →
    retirer le champ `authors` (Next dérivera depuis JSON-LD).
  - l35 : `authors: ['wwwatch']` → retirer.
  - l85-95 (approx) : retirer entièrement le bloc byline qui rend
    `<Link href="/author/...">wwwatch</Link>`. Garder la
    date / catégorie, rien d'autre.
- [ ] `app/about/page.tsx:33` — retirer
  `<script ... personSchema() ...>`. Garder uniquement
  `newsMediaOrgSchema()`.
- [ ] `lib/jsonld.ts`
  - Supprimer `AUTHOR_URL`, `AUTHOR_PHOTO_URL`.
  - Supprimer la fonction `personSchema()` (et son export).
  - Dans `newsArticleSchema`, remplacer le bloc `author: { '@type':
    'Person', name: 'wwwatch', url: AUTHOR_URL }` par :
    ```ts
    author: {
      '@type': 'NewsMediaOrganization',
      name: 'wwwatch',
      url: SITE_URL,
    },
    ```
  - Retirer les commentaires `sameAs: ['https://github.com/maintainer', ...]`.

Assets :

- [ ] `public/massimo.png` — **supprimer**.

Commentaires (handle `maintainer` à neutraliser) :

- [ ] `next.config.ts:8` — `// FUTURE(maintainer, 2026-07-01): ...` →
  `// FUTURE(maintainer, 2026-07-01): ...` (CONVENTIONS §Commentaires
  exige un nom + date butoir ; `maintainer` est le marqueur OSS
  acceptable).
- [ ] `scripts/publish.ts:112` — `// TODO(maintainer, 2026-06-01)` →
  `// TODO(maintainer, 2026-06-01)`.
- [ ] `lib/collectors/rss.ts:22` — `// TODO(maintainer, 2026-06-15)` →
  `// TODO(maintainer, 2026-06-15)`.

Settings locaux (non commit, mais à vérifier qu'aucun chemin absolu
`/Users/massimomarcellin/...` ne fuit en clair dans un fichier commité) :

- [ ] `.claude/settings.local.json:27` contient
  `/Users/massimomarcellin/...` — vérifier si ce fichier est dans le
  `.gitignore` (sinon, le retirer du suivi et l'ignorer ; voir §4.1).

### 6.3 `.env.example` — `GITHUB_MIRROR_REPO`

- [ ] L27 : `GITHUB_MIRROR_REPO=maintainer/wwwatch-journal` →
  `GITHUB_MIRROR_REPO=org/wwwatch-journal`. Garde la sémantique sans
  exposer le handle réel.

### 6.4 Vérification finale (grep — doit renvoyer 0)

Après scrub :

```bash
grep -rEi "(massimo|marcellin|maintainer|@gmail)" \
  --include="*.ts" --include="*.tsx" --include="*.scss" \
  --include="*.json" --include="*.yml" --include="*.sql" \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git \
  --exclude="PLAN*.md" --exclude="docs/plans/*" \
  --exclude="CONVENTIONS.md" --exclude="CLAUDE.md" --exclude="FUTURE.md" \
  -- .
```

Doit retourner **vide**. Les PLAN_\*.md sont déplacés en `docs/plans/`
(§4.3) — décider si on y applique aussi le scrub. **Décision :
scrubber `docs/plans/` également** (un lecteur curieux les ouvrira).
Re-grep sans l'exclude `PLAN*.md` ni `docs/plans/*` après le second
passage.

---

## 7. Stratégie git pour la publication

**Décision verrouillée : Option A — historique propre.** Le scrub des
références personnelles (§6) et l'absence de fuites secrets (§2.1 à
confirmer par gitleaks) rendent l'historique privé publiable tel quel,
modulo les commits de cleanup eux-mêmes.

**Mais attention** : les noms `wwwatch`, `maintainer`,
`massimo.png` apparaissent **dans l'historique** (commits PLAN_5 à 9).
Si on push l'historique brut, ils restent visibles dans `git log -p`
même après le scrub du HEAD. Trois lectures possibles :

A1. **On accepte.** Le nom est public sur LinkedIn de toute façon ; le
    scrub HEAD suffit comme signal d'intention. Risque : un grep dans
    l'historique trouvera quand même `wwwatch`.
A2. **`git filter-repo --replace-text`** pour réécrire l'historique et
    supprimer toutes les occurrences (`wwwatch` → `wwwatch`,
    `maintainer` → `maintainer`, etc.). Réécrit les SHAs — pas grave pour
    un nouveau repo public.
A3. **Commit orphelin** (§7 ancienne option C) : `git checkout --orphan
    main`, un seul commit "initial public release". Plus radical, plus
    propre, perd l'historique de design (qui de toute façon est déjà
    décrit dans `docs/plans/`).

**Recommandation : A2.** Réécrire l'historique avec `git filter-repo`
sur un clone dédié, push vers un **nouveau** repo public. L'ancien repo
privé reste tel quel (référence interne).

### 7.1 Procédure A2 détaillée

```bash
# 1. Clone dédié pour la réécriture
cd /tmp
git clone --no-local /Users/.../wwwatch wwwatch-oss
cd wwwatch-oss

# 2. Réécriture avec git filter-repo (https://github.com/newren/git-filter-repo)
#    Préparer un fichier de remplacements :
cat > /tmp/replacements.txt <<'EOF'
wwwatch==>wwwatch
wwwatch==>wwwatch
marcellin.massimo==>maintainer
maintainer==>maintainer
EOF
git filter-repo --replace-text /tmp/replacements.txt

# 3. Vérification post-filter
git log --all -p | grep -iE "(massimo|marcellin|maintainer)" || echo "OK"
gitleaks detect --source . --log-opts="--all"

# 4. Push vers le nouveau repo public
git remote add public git@github.com:<org>/wwwatch.git
git push public main --tags
```

`git filter-repo` n'est pas un binaire git natif — `brew install
git-filter-repo`. **Ne pas utiliser `git filter-branch`** (déprécié,
buggué).

### 7.2 Auteur des commits (`git config user.name/email`)

- [ ] Vérifier les auteurs commits actuels : `git log
  --format='%an <%ae>' | sort -u`. Si `wwwatch
  <noreply@wwwatch.dev>` apparaît, le réécrire via
  `git filter-repo --mailmap` ou
  `--name-callback`/`--email-callback`. Cible : `wwwatch
  <noreply@wwwatch.dev>` (ou similaire).
- [ ] Re-grep sur `git log --all --format='%an %ae'` après réécriture.

---

## 8. Tests de validation finale (avant push public)

Dans l'ordre, doivent tous passer :

- [ ] `npx tsc --noEmit` — pas d'erreur TypeScript.
- [ ] `npm run build` — build Next.js réussit.
- [ ] `npm run daily:dry` — run sans crasher (avec DRY_RUN, n'envoie rien).
- [ ] `npm run weekly:dry` — idem.
- [ ] `gitleaks detect --source . --log-opts="--all"` — exit 0.
- [ ] `npm audit --audit-level=high` — exit 0 (les 2 modérés postcss
  sont tolérés et documentés).
- [ ] Relecture humaine du README.md, LICENSE, SECURITY.md.
- [ ] Relecture humaine du diff vs branche actuelle (paranoïa avant
  push).

---

## 9. Toi vs Claude Code

### Toi (décisions humaines / actions externes)

Décisions déjà verrouillées : MIT (§5.3), zéro perso (§6), historique
A2 = `git filter-repo` (§7).

Actions humaines restantes :

1. Installer `git-filter-repo` et `gitleaks` (`brew install
   git-filter-repo gitleaks`).
2. Créer le repo public vide sur GitHub (Claude Code ne crée pas de
   ressource externe).
3. Activer **GitHub Private Vulnerability Reporting** sur ce nouveau
   repo (Settings → Security → "Enable private vulnerability
   reporting").
4. Rotater les secrets §2.2 dans Vercel env + GH Actions secrets +
   `.env.local` prod (nouvelle `INDEXNOW_KEY`).
5. Re-soumettre la nouvelle clé IndexNow à Bing/Yandex (un POST
   manuel ; voir doc IndexNow).
6. Push final vers le repo public, après que Claude Code ait validé
   §8.

### Claude Code (exécution, dans cet ordre)

**Phase 0 — Audit (rapport seulement, pas de modif)**
- Lancer `gitleaks detect --source . --log-opts="--all"` et rapporter.
- Lancer `git log --format='%an <%ae>' | sort -u` et rapporter.
- Lancer le grep de §6.4 (avant scrub) et confirmer la liste des hits.

**Phase 1 — Scrub des références personnelles (§6)**
- Supprimer `app/author/wwwatch/` (dossier entier).
- Éditer `app/layout.tsx` (footer), `app/journal/[date]/[slug]/page.tsx`
  (metadata + byline), `app/about/page.tsx` (drop personSchema call),
  `lib/jsonld.ts` (drop AUTHOR_*, personSchema, switch NewsArticle
  author to Organization).
- Supprimer `public/massimo.png`.
- Remplacer `maintainer` par `maintainer` dans les 3 commentaires
  TODO/FUTURE.
- Éditer `.env.example` (`GITHUB_MIRROR_REPO=org/wwwatch-journal`).
- Re-grep §6.4 → doit renvoyer vide.
- `npm run build` doit passer.
- **Commit** : `chore: scrub personal author references for open source`.

**Phase 2 — Artefacts internes (§4)**
- `git rm -r --cached memory/` + `memory/` dans `.gitignore`.
- `git rm -r .agents/` (duplique `.claude/`).
- `git rm --cached .claude/settings.local.json` (chemin absolu perso)
  + ajouter `.claude/settings.local.json` dans `.gitignore`.
- **Commit** : `chore: gitignore internal Claude Code artifacts`.

**Phase 3 — Organisation des plans (§4.3, option B)**
- `mkdir -p docs/plans/`.
- `git mv PLAN.md docs/plans/01-mvp.md`,
  `git mv PLAN_2.md docs/plans/02-pipeline-v1.md`, etc.
  Mapping suggéré (Claude Code choisit le titre lisible).
- Mettre à jour `CLAUDE.md` (les chemins).
- **Re-scrub** : appliquer le grep §6.4 sur `docs/plans/` et remplacer
  les hits restants par `wwwatch` / `maintainer`.
- **Commit** : `docs: move design plans under docs/plans/`.

**Phase 4 — Documentation publique (§5)**
- Écrire `README.md` (§5.1).
- Écrire `SECURITY.md` (§5.2) — pointer GitHub Private Vulnerability
  Reporting.
- Écrire `LICENSE` (MIT, 2026, `wwwatch contributors`).
- **Commit** : `docs: add README, LICENSE, SECURITY`.

**Phase 5 — Sécurité (§2.2)**
- Générer une nouvelle `INDEXNOW_KEY` (32 hex chars).
- Renommer/recréer `public/<new-key>.txt` (avec la valeur identique
  comme contenu, c'est le contrat IndexNow).
- Mettre à jour `.env.example` (valeur de remplacement, pas la vraie).
- **Commit** : `chore(security): rotate IndexNow key for open source`.

**Phase 6 — Qualité (§3.2)**
- Grep `console.*` pour détecter une éventuelle fuite PII.
- Grep `useEffect` (uniquement PostHog attendu).
- Grep `@import` dans `*.scss` (doit être vide).
- Spot check 3 fichiers `.module.scss` pour hardcoded values.
- Si trouvaille : fixer. **Commit** : `fix(...): ...`.

**Phase 7 — Validation finale (§8)**
- `npx tsc --noEmit`
- `npm run build`
- `npm run daily:dry`
- `npm run weekly:dry`
- `gitleaks detect --source . --log-opts="--all"`
- `npm audit --audit-level=high`
- Rapport final dans la conversation. Si tout vert : prêt pour la
  réécriture d'historique (§7.1) par l'humain.

**Phase 8 — Réécriture d'historique (§7.1)**
- Claude Code peut préparer le fichier `/tmp/replacements.txt` et la
  commande, mais le `git filter-repo` se fait dans un **clone dédié**
  hors du worktree principal. Lecture seule depuis ce repo.
- Toi : lances `git filter-repo` puis `git push public main --tags`.

---

## 10. Récap des décisions verrouillées

| Sujet | Décision |
|---|---|
| Licence | MIT (`wwwatch contributors`, 2026) |
| Auteur / byline / photo / email perso | **Tout retirer.** Auteur JSON-LD = NewsMediaOrganization "wwwatch" |
| Page `/author/wwwatch` | Supprimer |
| `public/massimo.png` | Supprimer |
| Commentaires `(maintainer, ...)` | Remplacer par `(maintainer, ...)` |
| Stratégie git | Option A2 — `git filter-repo --replace-text` sur clone dédié |
| Plans internes | Déplacer sous `docs/plans/`, scrub appliqué |
| Mémoire agent (`memory/`) | Gitignore + untrack |
| Rapport vuln | GitHub Private Vulnerability Reporting (pas d'email) |
| Rate limit `/api/subscribe` | Hors scope (note dans `FUTURE.md`) |
| Bumps majeurs deps | Hors scope (plan dédié) |
| `INDEXNOW_KEY` | Rotater avant push public |

---

## 11. Hors scope (à mettre dans `FUTURE.md`)

- Bumps majeurs : `@anthropic-ai/sdk` 0.30 → 0.98, `resend` 4 → 6,
  `marked` 15 → 18, `@neondatabase/serverless` 0.10 → 1.1, `typescript`
  5 → 6.
- Rate limiting `/api/subscribe` via `proxy.ts`.
- CI publique : workflow `npm run build` sur PR (GitHub Actions).
- `CODE_OF_CONDUCT.md`, `CHANGELOG.md`.
- Migration `next.config.ts` → `vercel.ts` (nouveau format Vercel).
