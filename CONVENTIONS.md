# CONVENTIONS.md — Règles de développement

> À lire par Claude Code **avant** chaque action significative. Ces règles
> ont priorité sur les habitudes par défaut. En cas de doute, demander.

---

## Principes (par ordre de priorité)

1. **Lisibilité > élégance.** Un junior doit pouvoir relire le code dans 6
   mois. Pas de one-liners cryptiques.
2. **Suppression > ajout.** Si tu peux supprimer du code pour atteindre le
   même résultat, fais-le. Moins de surface = moins de bugs.
3. **Explicite > implicite.** Pas de magie. Si une variable d'env est
   requise, jette une erreur claire au démarrage. Si un type peut être
   `null`, écris-le.
4. **Local > global.** Garde le code près de son usage. Crée un util
   partagé seulement à la 3ᵉ duplication, pas à la 2ᵉ.
5. **Standard > custom.** Utilise les API du framework / langage / lib
   avant de rouler la tienne. Un `URL.canParse()` natif bat un regex perso.
6. **Pas de gold plating MVP.** Si une feature n'est pas dans PLAN.md, on
   ne l'écrit pas. On la note dans un commentaire `// FUTURE:` si on y
   pense, et on continue.

---

## TypeScript

- `tsconfig.json` : `"strict": true` toujours. Inclut `noImplicitAny`,
  `strictNullChecks`, `noUncheckedIndexedAccess`.
- **Interdit** : `any`. Si vraiment inconnu, utilise `unknown` et narrow
  avec un type guard.
- **Interdit** : `as Type` sauf pour des cas explicitement justifiés (SDK
  qui n'a pas le type à jour — commenter pourquoi).
- **Interdit** : `// @ts-ignore` et `// @ts-expect-error` sans commentaire
  expliquant pourquoi.
- Préférer `type` à `interface` sauf si héritage / déclaration merging
  nécessaire.
- Noms de types : `PascalCase`, descriptifs. Pas de préfixe `I` (`User`,
  pas `IUser`).
- Discriminated unions plutôt que booleans multiples pour modéliser des
  états :
  ```ts
  // ❌
  { loading: boolean; error: string | null; data: User | null }
  // ✅
  { status: 'idle' } | { status: 'loading' } | { status: 'error'; error: string } | { status: 'ok'; data: User }
  ```
- Pas de fonctions qui retournent `T | null | undefined` sans raison. Choisir.

---

## Next.js 16 (lire attentivement, breaking changes vs 15)

### Params async (breaking)

Dans Next 16, `params` et `searchParams` sont **des Promises**. Toujours
`await` :

```ts
// ❌ Next 15 style (cassera en prod)
export default function Page({ params }: { params: { slug: string } }) {
  return <div>{params.slug}</div>;
}

// ✅ Next 16
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <div>{slug}</div>;
}
```

Idem pour `cookies()`, `headers()`, `draftMode()` qui sont async. Toujours
les `await`.

### `proxy.ts` (renommage de middleware.ts)

Le fichier `middleware.ts` est obsolète en Next 16, remplacé par `proxy.ts`
à la racine. Sémantique identique mais nommage plus clair (c'est une
couche proxy, pas un middleware applicatif).

Pour ce projet : pas besoin de `proxy.ts` au MVP. Si tu ajoutes du rate
limiting plus tard, c'est là.

### Caching opt-in (breaking)

**Tout est dynamique par défaut**. Pour cacher, utiliser explicitement
la directive `'use cache'` :

```ts
async function getActiveSubscriberCount() {
  'use cache';
  const supabase = getServerSupabase();
  const { count } = await supabase
    .from('subscribers')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');
  return count ?? 0;
}
```

Règle pour ce projet : **n'utilise `'use cache'` que si une fonction est
appelée plusieurs fois par requête ET que la valeur peut être servie
stale jusqu'au prochain build**. Au MVP, ne pas en abuser : on a 5 visites
par jour, le cache est prématuré.

### Server Components par défaut

- Tout composant est server par défaut. **N'ajouter `'use client'` que
  si nécessaire** : hooks React, event handlers, browser APIs.
- Si un composant n'a besoin de `'use client'` que pour une petite partie,
  isoler cette partie dans un sous-composant client. Pas tout le composant.
- Le data fetching se fait dans les Server Components avec `await`, pas
  via `useEffect`. Jamais.

### Pas de `useEffect` pour fetch

```tsx
// ❌
function Page() {
  const [data, setData] = useState(null);
  useEffect(() => { fetch('/api/x').then(r => r.json()).then(setData); }, []);
}

// ✅
async function Page() {
  const data = await getData();
  return <div>{data.name}</div>;
}
```

### React Compiler stable

Stable et activé en Next 16 par défaut.

- **Ne PAS écrire `useMemo`, `useCallback`, `React.memo`** sauf cas
  prouvé par profiling. Le compiler s'en charge.
- Si tu en vois dans le code existant, supprime-les (sauf si commentaire
  qui justifie).

---

## React

- Composants : `PascalCase`, un par fichier nommé `MyComponent.tsx`.
- Pas de `default export` pour les composants utilitaires (pour
  l'auto-import propre). `default export` uniquement pour `app/**/page.tsx`,
  `layout.tsx`, `route.ts` (requis par Next).
- Props : interface ou type dédié au-dessus du composant.
  ```tsx
  type ButtonProps = {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  };
  export function Button({ label, onClick, variant = 'primary' }: ButtonProps) { ... }
  ```
- Pas de `children: any`. Utilise `React.ReactNode`.
- Pas de logique métier dans le JSX. Extrais en fonction au-dessus du
  `return`.
- **Form** : préfère un `<form action={action}>` avec Server Action quand
  possible. Si non, garder client component minimal. **Jamais** de submit
  qui dépend d'un useEffect.

---

## SCSS & styles

### CSS Modules partout

Un fichier de styles par composant : `Component.module.scss` à côté du
`.tsx`. Aucune classe globale en dehors de `app/_styles/globals.scss`.

```tsx
import styles from './Button.module.scss';

export function Button({ label }: ButtonProps) {
  return <button className={styles.button}>{label}</button>;
}
```

### Structure

```
app/
  _styles/
    globals.scss        ← reset, base typo, importé dans layout.tsx
    tokens.scss         ← variables : couleurs, spacing, font, radius
    mixins.scss         ← mixins réutilisables (media-query, etc.)
  page.tsx
  page.module.scss
components/
  Button/
    Button.tsx
    Button.module.scss
```

### Tokens (jamais de hardcode)

Toutes les couleurs, espacements, tailles de police passent par des
**CSS custom properties** définies dans `tokens.scss` :

```scss
// app/_styles/tokens.scss
:root {
  --color-bg: #fafaf9;
  --color-fg: #111;
  --color-muted: #6b7280;
  --color-accent: #0b62d6;
  --color-border: #e5e5e5;

  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;

  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 12px;

  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
}
```

Usage :
```scss
.button {
  background: var(--color-fg);
  color: white;
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-md);
}
```

**Interdit** : `#fff`, `12px`, `rgb(0,0,0)` directement dans un module
SCSS. Toujours passer par un token.

### Sass moderne

- **Interdit** : `@import` (déprécié). Utilise `@use` et `@forward` :
  ```scss
  @use '../_styles/mixins' as mq;

  .card { @include mq.tablet { padding: var(--space-8); } }
  ```
- Pas de nesting > 2 niveaux. Si tu y arrives, ton DOM est trop profond.
- Nommage des classes dans les modules : `kebab-case`, lisible. Pas de BEM
  strict (les modules garantissent déjà le scoping).
  ```scss
  .card { ... }
  .card-title { ... }
  .card-title-featured { ... }   // état/variante
  ```

### Media queries mobile-first

```scss
// mixins.scss
@mixin tablet { @media (min-width: 640px) { @content; } }
@mixin desktop { @media (min-width: 1024px) { @content; } }
```

Toujours partir mobile, élargir.

---

## Organisation des fichiers

```
app/                  ← routes Next.js + composants spécifiques aux pages
  api/                ← route handlers
  _styles/            ← styles globaux (préfixe _ = ignoré par le routing)
components/           ← composants réutilisables (Button, Input, Card...)
lib/                  ← logique métier, intégrations externes (Supabase, Resend, Anthropic)
scripts/              ← entrypoints CLI (brief.ts) lancés par GH Actions
supabase/             ← schema SQL, migrations
```

- `components/` est pour le **réutilisable**. Si un composant n'est utilisé
  qu'à un endroit, il reste à côté de sa page dans `app/`.
- `lib/` ne contient **aucun composant React**. Que de la logique.
- Pas de dossier `utils/` fourre-tout. Nomme par domaine (`lib/email.ts`,
  `lib/research.ts`).

### Imports

- Chemin absolu via alias `@/` pour traverser des dossiers :
  `import { getSupabase } from '@/lib/supabase'`
- Chemin relatif uniquement pour les voisins immédiats :
  `import { Button } from './Button'`
- Tri des imports : externes d'abord, puis `@/*`, puis relatifs. Une
  ligne vide entre chaque groupe.

---

## Nommage

- **Fichiers** : `kebab-case.ts` pour les utils, `PascalCase.tsx` pour les
  composants, `route.ts` / `page.tsx` / `layout.tsx` pour Next.
- **Variables et fonctions** : `camelCase`.
- **Constantes globales** : `SCREAMING_SNAKE_CASE` (ex: `MODEL`, `MAX_USES`).
- **Types** : `PascalCase`. Suffixe `Props` pour les props, `Result` pour
  les retours d'API.
- **Booleans** : préfixer `is`, `has`, `can`, `should` (`isActive`,
  `hasError`).
- Pas d'abréviations sauf très conventionnelles (`id`, `url`, `db`).

---

## Gestion d'erreurs

### Règles

1. **Jamais de `catch` vide.** Au minimum `console.error`.
2. **Jamais de `catch` qui swallow et continue** sauf intention explicite,
   alors commenter pourquoi.
3. **Toujours typer** ce que tu attrapes :
   ```ts
   try { ... } catch (err) {
     // err: unknown — narrow avant d'utiliser
     const msg = err instanceof Error ? err.message : String(err);
     console.error('[research]', msg);
   }
   ```
4. **API routes** : ne JAMAIS renvoyer le message d'erreur brut au client.
   Logger côté serveur, renvoyer un message générique.
5. **Erreurs attendues** vs **erreurs inattendues** :
   - Attendues (email invalide, rate limit) → réponse HTTP normale 4xx.
   - Inattendues (DB down, OOM) → 500 + log détaillé.

### Logs

- Préfixer par `[module]` : `console.log('[email] envoyé à', to)`.
- Pas de `console.log` débile en prod (`console.log('here 1')`). Si c'est
  du debug temporaire, supprimer avant commit.
- Pas de log de PII (emails complets, payloads sensibles). Tronquer ou
  hasher si besoin.

---

## API routes & sécurité

- Toute API route valide ses inputs **avant** de toucher la DB. Au MVP,
  validation manuelle suffit (regex email, longueurs). Pas besoin de Zod
  pour 2 champs.
- Réponse JSON systématique, structure stable : `{ ok: true }` ou
  `{ error: 'message lisible' }`.
- Status HTTP corrects :
  - 200 succès
  - 400 input invalide
  - 401 non authentifié
  - 403 non autorisé
  - 404 non trouvé
  - 429 rate limit
  - 500 erreur serveur
- Pas de stack trace dans la réponse.
- Pas de secrets dans les URLs (query params). Toujours en headers ou
  body.
- CORS : laisser Next.js gérer par défaut (même origine). Pas d'API
  publique cross-origin au MVP.

---

## Variables d'environnement

- **`NEXT_PUBLIC_*`** : exposé au browser. **Uniquement** des trucs non
  sensibles (URL Supabase, anon key publique).
- **Tout le reste** : **jamais** importé dans un Client Component, jamais
  préfixé `NEXT_PUBLIC_`.
- Au démarrage du script ou du serveur, **fail fast** si une var requise
  manque :
  ```ts
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY manquant');
  ```
- Un `.env.example` à jour est obligatoire. Si tu ajoutes une var, tu la
  documentes là aussi.
- `.env.local` n'est **jamais** commit (vérifier `.gitignore`).

---

## Supabase / base de données

- Toutes les requêtes serveur passent par le client `service_role`,
  **jamais** par `anon`. (Au MVP on n'a pas d'auth utilisateur.)
- Toutes les requêtes gèrent `error` :
  ```ts
  const { data, error } = await supabase.from('x').select();
  if (error) throw error;
  ```
- Pas de SQL brut concaténé avec des inputs utilisateur. Le SDK Supabase
  paramétrise automatiquement, ne pas court-circuiter.
- Migrations : tout changement de schéma passe par un fichier dans
  `supabase/` versionné. Pas de "j'ai cliqué dans l'UI Supabase". Si on
  doit reconstruire la DB, le SQL est la source de vérité.
- RLS activée sur toutes les tables exposées. Pas de policy publique
  pour ce MVP (tout passe par service_role côté serveur).

---

## Appels LLM (Anthropic)

- **Modèle pinné** : `claude-opus-4-7`. Ne pas changer sans validation.
  Les évals de prompt ne sont pas portables entre modèles.
- **Tool web_search** : version `web_search_20260209`. La version est dans
  le contrat. Ne pas downgrade.
- **Logguer les usages** : tokens in/out, durée, succès/échec. Permet de
  suivre les coûts.
- **Le prompt est versionné dans le code** (`lib/prompt.ts`), pas dans
  une variable d'env. Une modification de prompt = un commit.
- **Pas de retry naïf** sur les appels LLM (coûteux). Un échec est loggué
  et investigué.
- **Jamais** de PII utilisateur dans un prompt sans nécessité.
- Sortie LLM = donnée non fiable. Si elle alimente du HTML, passer par
  `marked` (déjà fait). Pas de `dangerouslySetInnerHTML` sur du texte LLM
  sans sanitization.

---

## Git & commits

- **Conventional commits** : `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`.
  Sujet à l'impératif, < 72 caractères.
  ```
  feat(api): ajouter route /api/subscribe
  fix(email): échapper l'apostrophe dans le sujet
  chore: bump @anthropic-ai/sdk à 0.30.1
  ```
- Un commit = un changement cohérent. Pas de commit "WIP" en main.
- **Branche `main`** : toujours déployable. Si un commit casse `npm run
  build`, c'est un bug à fixer immédiatement.

---

## Dépendances

- Avant d'ajouter une lib, demande-toi 30 secondes : est-ce qu'une API
  native fait le job ? (`URL`, `Intl`, `crypto.randomUUID`, `structuredClone`…)
- Vérifie `package.json` avant : on ne l'a peut-être déjà installé.
- Pin les versions majeures (`^14.2.5` OK, `latest` jamais).
- Pas de lib < 1k stars GitHub sauf si maintenue par un acteur connu
  (Vercel, Supabase, etc.).
- Audit régulier : `npm outdated`, `npm audit`. Mettre à jour quand
  cohérent, pas en panique.

---

## Commentaires

- **Quand commenter** : pour expliquer **POURQUOI**, pas **QUOI**. Le code
  lui-même dit le quoi.
  ```ts
  // ❌ inutile
  // incrémente le compteur
  count++;

  // ✅ utile
  // Resend rate-limit à 10 req/s en free tier, on lisse à 8 par sécurité.
  await sleep(125);
  ```
- `// TODO:` autorisé uniquement avec un nom + une date butoir :
  `// TODO(toi, 2026-06-01): ajouter retry`
- `// FIXME:` interdit en `main`. Soit tu fixes, soit tu ouvres un ticket.
- `/** JSDoc */` pour les fonctions exportées de `lib/`. Pas pour les
  composants (les types parlent d'eux-mêmes).

---

## Performance

- **Pas d'optimisation prématurée.** Mesurer avant.
- Pour ce MVP, les seuls hotspots possibles sont :
  - Le rendu de la landing (déjà server component → fast)
  - L'envoi en boucle des emails (déjà séquentiel avec sleep, OK pour
    < 500 abonnés)
- Si tu te poses la question "est-ce que je devrais cacher ça ?", la
  réponse au MVP est **non**.

---

## Tests

- Hors scope MVP. **Mais** : tout code que tu écris doit être facilement
  testable plus tard. Concrètement :
  - Fonctions pures > side-effects.
  - Dépendances injectées plutôt qu'importées dur (parfois).
  - Un seul niveau de responsabilité par fichier.
- Si une fonction critique (`buildPrompt`, `renderHtml`, parsing email)
  pète, on a perdu une semaine. Vérifie-la manuellement avec 3 cas
  limites avant de merge.

---

## Règles spécifiques pour Claude Code

Ces règles s'adressent à toi, l'agent qui exécute le plan.

1. **Lis PLAN.md ET CONVENTIONS.md avant chaque phase.** Pas seulement
   la première fois.
2. **Une phase à la fois.** Ne pas enchaîner sans validation humaine
   explicite quand PLAN.md le dit.
3. **Ne pas inventer de packages.** Si tu hésites sur l'existence d'une
   lib, vérifie sur npm avant d'écrire l'import.
4. **Pas de feature en dehors du scope.** Si une idée semble utile mais
   n'est pas dans PLAN.md, ajoute-la dans `FUTURE.md` (créer si besoin) et
   continue.
5. **Avant de commiter** : `npm run build` doit passer. Sinon, fix.
6. **Si une instruction de PLAN.md contredit CONVENTIONS.md** : suis
   CONVENTIONS.md et signale le conflit en commentaire de PR.
7. **Si tu hésites entre deux approches** : choisis la plus simple, mets
   un commentaire `// NOTE:` expliquant le tradeoff, et continue. Ne
   demande pas pour les micro-décisions.
8. **Pas de refacto de code "au passage"** non demandée. Si tu vois un
   truc moche, note-le dans `FUTURE.md`. Sinon les PRs deviennent
   illisibles.
9. **Pas de génération de code "défensif" inutile.** Pas de 50 lignes de
   validation pour un input déjà typé en TS. Garde le code lisible.
10. **Pas d'emoji dans le code source.** Dans les commits, le markdown
    utilisateur (newsletter), oui. Dans le code, jamais.

---

## Anti-patterns à bannir (récap)

| ❌ | ✅ |
|---|---|
| `any` | `unknown` + type guard |
| `useEffect` pour fetch | Server Component + `await` |
| `useMemo` / `useCallback` réflexes | Rien (React Compiler) |
| `params.slug` direct | `const { slug } = await params` |
| `@import` SCSS | `@use` / `@forward` |
| Couleurs hardcodées | `var(--color-*)` |
| `catch (err) {}` | `catch (err) { console.error('[mod]', err); throw err; }` |
| `process.env.X!` (non-null assertion) | check + throw si manquant |
| `'use client'` sur toute la page | sous-composant client minimal |
| `middleware.ts` (Next 15) | `proxy.ts` (Next 16) |
| `// TODO: fix later` | `// TODO(nom, 2026-MM-DD): action précise` |
