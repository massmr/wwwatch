# wwwatch — Plan de build MVP

> Newsletter hebdo de veille IA pour product engineers. Brief généré chaque
> lundi par Claude API + web_search, envoyé via Resend aux abonnés stockés
> dans Neon Postgres. Landing Next.js pour l'inscription. Cron via GitHub Actions.

**Objectif** : 1ʳᵉ newsletter envoyée à moi-même (dry run) en fin de journée,
landing publique déployée le même soir.

> **À lire en parallèle** : `CONVENTIONS.md` définit les règles de
> développement (TypeScript, Next.js 16, SCSS, erreurs, sécurité…). Tout
> conflit entre ce plan et CONVENTIONS.md se résout en faveur de CONVENTIONS.md.

---

## Stack figée (ne pas re-débattre)

- **App** : Next.js **16** (App Router, React 19.2, Turbopack stable,
  React Compiler stable) + TypeScript strict — une seule app, pas de monorepo
- **Styles** : **SCSS Modules** + CSS custom properties pour les tokens
  (pas de Tailwind)
- **DB** : Neon Postgres (free tier)
- **Email** : Resend (free tier : 3 000 mails/mois, 100/jour)
- **LLM** : Anthropic API — modèle `claude-sonnet-4-6`, tool `web_search_20250305`
  (voir Phase 3 pour le détail des décisions de coût/fiabilité)
- **Cron** : GitHub Actions (script Node lancé en CI, **pas** une API route
  Next.js — sinon timeout Vercel free)
- **Hébergement** : Vercel (web) + Neon (DB) + Resend (mail)

**Trois pièges Next.js 16 à connaître** (détaillés dans CONVENTIONS.md) :
1. `params` et `searchParams` sont **async** → `await` obligatoire
2. `middleware.ts` n'existe plus → `proxy.ts` (pas besoin pour ce MVP)
3. Caching **opt-in** uniquement via `'use cache'` (tout est dynamique par
   défaut)

---

## Arbre cible

```
wwwatch/
├── README.md
├── PLAN.md                          ← ce fichier
├── CONVENTIONS.md                   ← règles de dev
├── package.json
├── next.config.ts
├── tsconfig.json
├── .gitignore
├── .env.example
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    ← landing (server component)
│   ├── page.module.scss
│   ├── SubscribeForm.tsx           ← client component minimal
│   ├── SubscribeForm.module.scss
│   ├── actions.ts                  ← Server Actions (subscribe)
│   └── _styles/
│       ├── globals.scss            ← reset, base typo
│       ├── tokens.scss             ← CSS custom properties
│       └── mixins.scss             ← media queries, etc.
├── lib/
│   ├── db.ts                       ← client Neon (@neondatabase/serverless)
│   ├── prompt.ts                   ← LE prompt, cœur du produit
│   ├── research.ts                 ← appel Claude + web_search
│   └── email.ts                    ← markdown → HTML + Resend
├── scripts/
│   └── brief.ts                    ← entrypoint exécuté par GH Actions
├── neon/
│   └── schema.sql
└── .github/workflows/
    └── weekly-brief.yml
```

`lib/` est partagé entre les Server Components / Actions et le script
`scripts/brief.ts`. Une seule install de deps. Une seule version de chaque SDK.

**Note** : pas de `/api/subscribe` route. On utilise une **Server Action**
dans `app/actions.ts` (pattern Next 16 idiomatique). Moins de code, moins
de surface.

---

## Phase 1 — Setup Next.js 16 (15 min)

**Goal** : `npm run dev` lance une page blanche stylée SCSS sur localhost.

**Files** :

### `package.json`
```json
{
  "name": "wwwatch",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "brief": "tsx scripts/brief.ts",
    "brief:local": "tsx --env-file=.env.local scripts/brief.ts",
    "brief:dry": "DRY_RUN=1 tsx --env-file=.env.local scripts/brief.ts"
  },
  "dependencies": {
    "next": "^16.0.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "@neondatabase/serverless": "^0.10.0",
    "@anthropic-ai/sdk": "^0.30.0",
    "resend": "^4.0.0",
    "marked": "^14.1.0"
  },
  "devDependencies": {
    "typescript": "^5.5.3",
    "@types/node": "^20.14.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "sass": "^1.77.0",
    "tsx": "^4.16.0"
  },
  "engines": { "node": ">=20" }
}
```

### `next.config.ts`
```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Sass est supporté nativement par Next.js, aucune config requise.
};

export default nextConfig;
```

### `tsconfig.json`
Standard Next 16 avec `"paths": { "@/*": ["./*"] }`. Claude Code peut le
générer avec `next dev` (créé automatiquement).

### `app/_styles/tokens.scss`
```scss
:root {
  --color-bg: #fafaf9;
  --color-fg: #111;
  --color-muted: #6b7280;
  --color-accent: #0b62d6;
  --color-accent-success: #047857;
  --color-error: #dc2626;
  --color-border: #e5e5e5;
  --color-card-bg: #fff;

  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.25rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --space-16: 4rem;

  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 12px;

  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
               "Helvetica Neue", sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;

  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-3xl: 1.875rem;
  --text-4xl: 2.25rem;
  --text-5xl: 3rem;
}
```

### `app/_styles/mixins.scss`
```scss
@mixin tablet { @media (min-width: 640px) { @content; } }
@mixin desktop { @media (min-width: 1024px) { @content; } }
```

### `app/_styles/globals.scss`
```scss
*, *::before, *::after { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  background: var(--color-bg);
  color: var(--color-fg);
  font-family: var(--font-sans);
  font-size: var(--text-base);
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, p { margin: 0; }

a { color: inherit; }

button { font-family: inherit; cursor: pointer; }
```

### `app/layout.tsx`
```tsx
import type { Metadata } from 'next';
import './_styles/tokens.scss';
import './_styles/globals.scss';

export const metadata: Metadata = {
  title: 'wwwatch — La veille IA pour product engineers',
  description:
    "Une newsletter hebdo, triée par un product engineer pour les product engineers. Modèles, outils, papers : ce qui change vraiment ta stack.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
```

### `app/page.tsx`
Placeholder minimal pour valider P1. Sera enrichi en P4.
```tsx
import styles from './page.module.scss';

export default function Page() {
  return <main className={styles.main}>wwwatch</main>;
}
```

### `app/page.module.scss`
Vide pour l'instant : `.main { padding: var(--space-8); }`.

### `.gitignore`
```
node_modules
.next
.env
.env.local
.env.*.local
.DS_Store
*.log
out/
.vercel
.turbo
```

### `.env.example`
Voir Annexe B.

**Acceptance** : `npm install && npm run dev` ouvre http://localhost:3000
sans erreur. La page affiche "wwwatch", la couleur de fond est `#fafaf9`
(token appliqué correctement).

---

## Phase 2 — DB Neon (5 min)

**Goal** : tables `subscribers` et `briefs` créées, accessibles via `DATABASE_URL`.

**Setup MCP Neon** (une seule fois, déjà fait si `npx neonctl@latest init` a tourné) :
```bash
npx neonctl@latest init
# → OAuth, crée une API key, configure le MCP dans ~/.claude.json
```
Alternative manuelle si besoin :
```bash
claude mcp add neon -- npx -y @neondatabase/mcp-server-neon start "<NEON_API_KEY>"
```

**Setup projet** :
1. Via MCP Neon dans Claude Code : créer un projet `wwwatch` (région `eu-west-2`)
2. Récupérer le `DATABASE_URL` (connection string pooled) → `.env.local`
3. Appliquer `neon/schema.sql` via le MCP (execute SQL) ou Neon Console → SQL Editor

### `neon/schema.sql`
```sql
create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  status text not null default 'active'
    check (status in ('active', 'unsubscribed', 'bounced')),
  source text,
  created_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);

create index if not exists subscribers_status_idx
  on public.subscribers(status);

create table if not exists public.briefs (
  id uuid primary key default gen_random_uuid(),
  sent_at timestamptz not null default now(),
  subject text not null,
  markdown text not null,
  recipient_count int not null default 0
);
```

**Acceptance** : tables visibles dans Neon Console → Tables.

---

## Phase 3 — Brief generator (1h, le plus important)

**Goal** : `npm run brief:dry` génère un brief markdown sauvegardé localement
dans `out/YYYY-MM-DD.md` et envoyé à `DRY_RUN_EMAIL`.

### `lib/db.ts`
```ts
import { neon } from '@neondatabase/serverless';

/** Retourne un client SQL Neon (tagged template literals). */
export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL manquant');
  return neon(url);
}

export async function getActiveSubscribers(): Promise<string[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT email FROM public.subscribers WHERE status = 'active'
  `;
  return rows.map((r) => r['email'] as string);
}

export async function upsertSubscriber(email: string): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO public.subscribers (email, status, source)
    VALUES (${email}, 'active', 'landing')
    ON CONFLICT (email) DO UPDATE SET status = 'active'
  `;
}

export async function logBrief(opts: {
  subject: string;
  markdown: string;
  recipientCount: number;
}): Promise<void> {
  const sql = getSql();
  try {
    await sql`
      INSERT INTO public.briefs (subject, markdown, recipient_count)
      VALUES (${opts.subject}, ${opts.markdown}, ${opts.recipientCount})
    `;
  } catch (err) {
    console.error('[db] Impossible de logger le brief :', err);
  }
}
```

### `lib/prompt.ts`
**LE prompt central**. Voir Annexe A pour le contenu intégral. Exporte
`buildPrompt(now: Date): string`. Ne pas le réinventer — il représente
les itérations du prompt engineering.

### `lib/research.ts`
Appel Anthropic. **Code de référence** (à respecter, surtout les versions) :
```ts
import Anthropic from '@anthropic-ai/sdk';
import { buildPrompt } from './prompt';

const MODEL = 'claude-sonnet-4-6';
const MAX_RETRIES = 2;
type TextBlock = { type: 'text'; text: string };

export async function generateBriefMarkdown(maxUses = 5): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY manquant');

  // maxRetries: 0 — retry géré manuellement pour distinguer erreurs réseau
  // (retryables) et erreurs logiques (non-retryables).
  const client = new Anthropic({ apiKey, maxRetries: 0 });
  const prompt = buildPrompt(new Date());

  console.log(`[research] Appel ${MODEL} avec web_search (max_uses=${maxUses})...`);
  const start = Date.now();

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      // stream() uses SSE (keep-alive) — évite timeout sur longues tool-use chains.
      const response = await client.messages.stream({
        model: MODEL,
        max_tokens: 8192,
        tools: [
          {
            // SDK pas toujours à jour sur les types de server tools.
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: maxUses,
          } as never,
        ],
        messages: [{ role: 'user', content: prompt }],
      }).finalMessage();

      const text = response.content
        .filter((b): b is TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n\n')
        .trim();

      if (!text) throw new Error("Claude n'a rien retourné");

      const { usage } = response;
      console.log(`[research] OK en ${((Date.now() - start) / 1000).toFixed(1)}s`);
      console.log(`[research] tokens in=${usage.input_tokens} out=${usage.output_tokens}`);
      return text;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "Claude n'a rien retourné") throw err; // non-retryable
      lastErr = err;
      if (attempt <= MAX_RETRIES)
        console.warn(`[research] Tentative ${attempt} échouée (${msg}), retry...`);
    }
  }

  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(`[research] Échec après ${MAX_RETRIES + 1} tentatives : ${msg}`);
}
```

**Points critiques à NE PAS modifier** :
- `model: 'claude-sonnet-4-6'` — Opus à $12/run (60 recherches × 743K tokens) ;
  Sonnet ~$0.60/run, qualité suffisante pour ce use case. Validé en prod.
- `type: 'web_search_20250305'` — downgrade depuis `web_search_20260209` : le sandbox
  de dynamic filtering causait "Detection timed out after 25s" systématique.
  Repasser sur `20260209` si Anthropic stabilise le service.
- `max_uses: 5` (prod) / `3` (dry-run) — passé par `scripts/brief.ts`.
  web_search_20260209 faisait ~3 sous-recherches/use → 20 uses = 60 recherches =
  743K tokens. Avec `20250305` (sans sandbox) : 5 uses ≈ 5 recherches directes.
- `max_tokens: 8192` — suffisant pour ~900 mots de brief + tool calls.
- `stream().finalMessage()` — ne pas revenir à `create()` : bloque en attendant
  la réponse JSON complète → timeout après 40+ min.
- Le cast `as never` sur le tool : le SDK n'a pas toujours le type le plus récent.

### `lib/email.ts`
```ts
import { Resend } from 'resend';
import { marked } from 'marked';

function renderHtml(markdown: string, subject: string): string {
  const body = marked.parse(markdown, { gfm: true }) as string;
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>${subject}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
       max-width:600px;margin:0 auto;padding:24px;color:#111;line-height:1.55}
  h2{margin-top:32px;font-size:18px;letter-spacing:-0.01em}
  a{color:#0b62d6}
  blockquote{border-left:3px solid #e5e5e5;margin:8px 0;
             padding:4px 0 4px 12px;color:#333;font-size:14px}
  hr{border:none;border-top:1px solid #eee;margin:28px 0}
  code{background:#f4f4f4;padding:1px 5px;border-radius:3px;font-size:13px}
  .footer{margin-top:40px;padding-top:20px;border-top:1px solid #eee;
          color:#888;font-size:12px}
</style></head><body>
${body}
<div class="footer">wwwatch — veille IA hebdo pour product engineers.<br>
Pour te désinscrire, réponds "stop".</div>
</body></html>`;
}

export type SendResult = { sent: number; failed: number };

export async function sendBriefToList(
  emails: string[],
  markdown: string,
  subject: string
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY manquant');

  const from = process.env.EMAIL_FROM || 'onboarding@resend.dev';
  const replyTo = process.env.EMAIL_REPLY_TO;

  const resend = new Resend(apiKey);
  const html = renderHtml(markdown, subject);

  let sent = 0;
  let failed = 0;

  for (const to of emails) {
    try {
      const { error } = await resend.emails.send({
        from, to, subject, html, replyTo,
      });
      if (error) {
        console.error(`[email] FAIL ${to}:`, error);
        failed++;
      } else {
        sent++;
      }
    } catch (err) {
      console.error(`[email] FAIL ${to}:`, err);
      failed++;
    }
    // Resend rate-limit à 10 req/s en free tier, on lisse à 8 par sécurité.
    await new Promise((r) => setTimeout(r, 125));
  }

  return { sent, failed };
}
```

### `scripts/brief.ts`
Orchestration :
1. Générer le brief markdown via `generateBriefMarkdown()`
2. Sauvegarder dans `out/YYYY-MM-DD.md` (utile pour debug + archive)
3. Si `DRY_RUN=1` → envoyer uniquement à `DRY_RUN_EMAIL`
   Sinon → récupérer `getActiveSubscribers()` et envoyer à tous
4. Logger en DB via `logBrief()` (sauf en dry run)

Sujet : `wwwatch — semaine du DD mois` (Intl `fr-FR`, format `day: "2-digit", month: "long"`).

Le code complet de `scripts/brief.ts` est laissé à Claude Code en suivant
les conventions. Critères :
- Charger les vars d'env (Node 20+ supporte `--env-file=.env.local` nativement,
  alternative : `import 'dotenv/config'` si tu préfères dotenv)
- `mkdirSync('out', { recursive: true })` avant écriture
- Filename : `out/${new Date().toISOString().slice(0, 10)}.md`
- Process exit avec code 1 si erreur fatale

**Acceptance** :
- `npm run brief:dry` génère un `out/*.md` contenant des liens cliquables
  réels (vérifier 3-5 au hasard, doivent répondre 200)
- L'email arrive sur `DRY_RUN_EMAIL` en < 5 min
- Coût ~0.50-1€ par run (visible dans la console Anthropic)

---

## Phase 4 — Landing + Server Action (45 min)

**Goal** : landing publique avec form qui crée une ligne dans `subscribers`
via Server Action (pattern Next 16).

### `app/actions.ts`
```ts
'use server';

import { upsertSubscriber } from '@/lib/db';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SubscribeState =
  | { status: 'idle' }
  | { status: 'ok'; message: string }
  | { status: 'error'; message: string };

export async function subscribe(
  _prev: SubscribeState,
  formData: FormData
): Promise<SubscribeState> {
  const raw = formData.get('email');
  if (typeof raw !== 'string' || !EMAIL_RE.test(raw)) {
    return { status: 'error', message: 'Email invalide.' };
  }

  const email = raw.trim().toLowerCase();

  try {
    await upsertSubscriber(email);
    return {
      status: 'ok',
      message: 'Inscrit. Le prochain brief arrive lundi matin.',
    };
  } catch (err) {
    console.error('[subscribe]', err);
    return { status: 'error', message: 'Erreur serveur, réessaie plus tard.' };
  }
}
```

### `app/SubscribeForm.tsx`
```tsx
'use client';

import { useActionState } from 'react';
import { subscribe, type SubscribeState } from './actions';
import styles from './SubscribeForm.module.scss';

const initial: SubscribeState = { status: 'idle' };

export function SubscribeForm() {
  const [state, formAction, pending] = useActionState(subscribe, initial);

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.row}>
        <input
          type="email"
          name="email"
          required
          placeholder="ton@email.com"
          className={styles.input}
          disabled={pending}
        />
        <button type="submit" disabled={pending} className={styles.button}>
          {pending ? '…' : "S'inscrire"}
        </button>
      </div>
      {state.status === 'error' && (
        <p className={styles.error}>{state.message}</p>
      )}
      {state.status === 'ok' && (
        <p className={styles.success}>{state.message}</p>
      )}
    </form>
  );
}
```

### `app/page.tsx` (server component)
```tsx
import styles from './page.module.scss';
import { SubscribeForm } from './SubscribeForm';

export default function Page() {
  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.badge}>
          <span className={styles.dot} />
          <span>NEWSLETTER HEBDO · GRATUITE</span>
        </div>

        <h1 className={styles.title}>
          La veille IA pour <em>product engineers</em>.
        </h1>

        <p className={styles.subtitle}>
          Un brief par semaine, le lundi matin. Trié par un product engineer
          pour les product engineers. Pas de hype, pas de business porn —
          juste ce qui change ta stack cette semaine.
        </p>

        <SubscribeForm />

        <div className={styles.cards}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>🧠 Modèles</div>
            Releases Anthropic, OpenAI, Google, open source.
          </div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>🛠️ Outils</div>
            Frameworks, APIs, repos GitHub qui décollent.
          </div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>📑 Papers</div>
            Le top de Hugging Face Daily + arXiv.
          </div>
        </div>

        <footer className={styles.footer}>
          Aucune pub. Désinscription en un clic.
        </footer>
      </div>
    </main>
  );
}
```

### `app/page.module.scss` et `app/SubscribeForm.module.scss`
Claude Code peut générer ces SCSS modules en suivant CONVENTIONS.md
(section "SCSS & styles"). Contraintes :
- **Mobile-first**. Le layout doit être propre à 360px de large minimum.
- **Tokens uniquement** : pas de `#000`, `12px` ou `rgb()` direct. Toujours
  `var(--*)`.
- **Pas de nesting > 2 niveaux**.
- Imports Sass via `@use`, pas `@import`.
- Pour les media queries : `@use '../_styles/mixins' as mq;` puis
  `@include mq.tablet { ... }`.

Direction visuelle :
- Layout centré, max-width ~640px, padding généreux.
- H1 : taille `--text-4xl` mobile, `--text-5xl` desktop. Tracking serré
  (`letter-spacing: -0.02em`).
- Pastille "NEWSLETTER HEBDO" : monospace, gris, petite, avec point vert
  (`--color-accent-success`).
- Form : input à gauche, bouton noir à droite, stack vertical sur mobile.
- Cards : grille 1 colonne mobile, 3 colonnes desktop. Fond blanc, border
  léger, padding moyen.
- Footer : très discret, monospace, gris clair.

**Acceptance** :
- Form soumis → ligne dans `public.subscribers`
- Re-soumettre le même email → pas d'erreur (upsert)
- Email invalide → message rouge inline
- Mobile (360px viewport) : pas de scroll horizontal, tout lisible
- Pas de console error / warning en dev

---

## Phase 5 — CI cron (15 min)

**Goal** : workflow GitHub Actions qui exécute `npm run brief` chaque lundi.

### `.github/workflows/weekly-brief.yml`
```yaml
name: Weekly brief

on:
  schedule:
    # Lundi 06:00 UTC = 07:00 Paris hiver / 08:00 Paris été
    - cron: "0 6 * * 1"
  workflow_dispatch: # déclenchement manuel pour tester

jobs:
  brief:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - run: npm run brief
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          EMAIL_FROM: ${{ secrets.EMAIL_FROM }}
          EMAIL_REPLY_TO: ${{ secrets.EMAIL_REPLY_TO }}
```

**Setup** :
1. GitHub repo → Settings → Secrets and variables → Actions
2. Ajouter chaque secret listé ci-dessus
3. Onglet Actions → "Weekly brief" → "Run workflow" pour tester

**Acceptance** : run manuel termine en vert, email reçu par les abonnés.

---

## Phase 6 — Déploiement (30 min)

**Web** :
1. `vercel.com` → Import GitHub repo
2. Vercel détecte Next.js 16 automatiquement, build avec Turbopack
3. Variables d'env à ajouter dans Vercel :
   - `DATABASE_URL` (connection string Neon — utiliser la version **pooled**)
4. Deploy → URL publique fonctionnelle

**Email production** :
1. Resend dashboard → Domains → Add `wwwatch.fr` (ou ton domaine)
2. Configurer DNS : SPF + DKIM + DMARC (3 records)
3. Vérifier que le domaine passe en "Verified"
4. Mettre à jour `EMAIL_FROM` partout : `brief@wwwatch.fr`

Sans domaine vérifié : tu peux **uniquement** t'envoyer à toi-même via
`onboarding@resend.dev`. Bloquant pour la diffusion réelle.

**Acceptance finale** :
- Inscription publique fonctionne sur l'URL Vercel
- Trigger manuel du workflow envoie le brief aux abonnés
- Email arrive dans Gmail Primary (pas Promotions/Spam)
- Lighthouse mobile > 90 sur la landing

---

## Annexe A — Le prompt complet (`lib/prompt.ts`)

> **Version B** — prompt réécrit après validation du dry run.
> Ton direct, structure flexible, interdictions formelles anti-boilerplate.
> `lib/prompt.ts` est la source de vérité — cette annexe est une copie de référence.

```ts
export function buildPrompt(now: Date): string {
  const iso = now.toISOString().slice(0, 10);
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  return `# RÔLE
Tu es un product engineer qui rédige la veille IA hebdo pour d'autres product engineers.

# PÉRIODE
Du ${weekStart} au ${iso} (7 derniers jours).

# OBJECTIF
Répondre à : "Est-ce que ma stack a bougé cette semaine ?"

# STRATÉGIE DE RECHERCHE

Cherche dans ces catégories, mais adapte selon l'actu réelle :

**Annonces officielles** : Anthropic, OpenAI, Google DeepMind, Meta, Mistral, xAI, Cohere
→ Recherche générique type "AI model release this week" + recherches ciblées si tu trouves quelque chose de précis

**Research** : Hugging Face Daily Papers, arXiv cs.AI trending
→ Si pas de paper pertinent cette semaine, skip cette catégorie

**Communauté** : Hacker News top AI, reddit LocalLLaMA, GitHub trending
→ Filtre par score (HN > 100 points, GitHub > 500 stars cette semaine)

**Triangulation** : TLDR AI newsletter, Import AI, funding rounds récents
→ Bonus, pas obligatoire si tu as déjà suffisamment de contenu

**Nombre de recherches** : autant que nécessaire (généralement 10-20).
Si une recherche ne donne rien de pertinent, pivote vers autre chose.
Si un sujet domine l'actu (ex: grosse annonce Google I/O), creuse davantage.

# CRITÈRES DE FILTRAGE

Garde un item seulement s'il répond à AU MOINS UN critère :
- Nouveau modèle ou MAJ majeure (capacités, prix, fenêtre de contexte)
- Outil/framework/API utilisable maintenant
- Paper avec impact pratique (benchmark battu, technique reproductible)
- Levée > 20M$ ou acquisition qui change le marché
- Incident technique structurant (faille, jailbreak public)

**Écarte systématiquement** :
- Avis personnels non sourcés
- Hype sans produit concret
- Redites de news déjà couvertes depuis > 7 jours
- Rumeurs sans confirmation
- Annonces "coming soon" sans date

# GARDE-FOUS ANTI-HALLUCINATION (CRITIQUE)

Ces règles sont NON-NÉGOCIABLES :

- Chaque item DOIT avoir une URL réellement visitée via web_search
- Pas d'URL vérifiée → n'inclus PAS l'item, même s'il semble pertinent
- Pour chaque chiffre cité (benchmark, prix, levée) : la source doit l'indiquer explicitement, sinon omets le chiffre
- Date d'annonce antérieure à ${weekStart} → écarte l'item
- Rumeurs : marque "🔁 Rumeur" et précise la source
- Sources contradictoires → mentionne le désaccord

# FORMAT DE SORTIE

Brief en markdown, 500-900 mots (ajuste selon l'actualité réelle de la semaine).

---

## ⚡ Les 3 signaux de la semaine
Top 3 items qui changent vraiment quelque chose pour un product engineer.

Format pour chaque signal : titre + pourquoi ça compte + lien cliquable.
Sois concret : pas "ça améliore les performances", mais "4× plus rapide" ou "coût divisé par 2".

---

## 🧠 Modèles & APIs
3-8 items selon l'actualité de la semaine.

Si pas de release majeure cette semaine : écris "Semaine calme côté modèles" OU skip cette section.

Pour chaque item, **varie la structure** (pas de template rigide) :
- Titre cliquable [Nom] — [lien](url)
- Ce que c'est en 1 phrase
- Pourquoi c'est utile (ou pas) en 1 phrase
- Prix si pertinent, une seule fois : 💲 $X in / $Y out par 1M tokens

---

## 🛠️ Outils & frameworks
2-6 items selon l'actualité.

Même logique que Modèles : adapte le nombre au contenu réel de la semaine.

Pour chaque outil :
- Titre + lien cliquable
- Ce que ça fait
- Pourquoi c'est utile (ou pas) pour un product engineer
- GitHub stars si pertinent (ex: nouveau repo qui explose)

---

## 📑 Papers à connaître
0-4 papers max.

Si pas de paper pertinent cette semaine : **skip cette section entièrement**.
Ne mets PAS de placeholder type "Pas de papers cette semaine".

Pour chaque paper :
**[Titre]** — [lien arxiv/source](url)
Une phrase sur la contribution technique.
**Application** : ce que ça change si on l'intègre dans un produit.

---

## 🔭 À surveiller
0-3 items max.

Annonces partielles, dates de release connues, betas privées repérées.
Format ultra-court : une ligne par item.

Si rien à surveiller : skip cette section.

---

# TON ET STYLE

Tu parles comme un product engineer à un autre product engineer.
Pas comme un communiqué de presse. Pas comme un chatbot corporate.

✓ Bon ton :
- "Cursor fait tourner tes refactos dans le cloud. Fini le lag."
- "Gemini Flash : 4× plus rapide, $1.50/$9. Upgrade direct si t'es dessus."

✗ Mauvais ton :
- "Pourquoi ça compte : cela permet d'optimiser les workflows de développement"
- "Cette release apporte des améliorations substantielles aux capacités existantes"

**Interdictions formelles** :

❌ Répéter "Pourquoi ça compte :" plus de 2× dans tout le brief
❌ Utiliser "⚡ À tester :" (intègre l'info naturellement dans le texte)
❌ Meta-commentaires ("je n'ai pas pu rechercher", "lacune", "limite d'appels")
❌ Blockquotes (>) sauf si tu cites littéralement quelqu'un
❌ Liens non-cliquables (toujours format markdown [texte](url))

**Si la semaine est calme** : écris 400-500 mots au lieu de 900. Ne remplis pas avec du bruit.

Démarre directement par \`## ⚡ Les 3 signaux de la semaine\`.
Pas de préambule, pas d'introduction.`;
}
```

---

## Annexe B — `.env.example`

```bash
# Neon (DB pour les abonnés) — connection string pooled
DATABASE_URL=postgres://user:password@ep-xxx.eu-west-2.aws.neon.tech/neondb?sslmode=require

# Anthropic (génération du brief)
ANTHROPIC_API_KEY=sk-ant-...

# Resend (envoi email)
RESEND_API_KEY=re_...
EMAIL_FROM=onboarding@resend.dev
EMAIL_REPLY_TO=ton.email@gmail.com

# Pour tester sans envoyer aux abonnés
DRY_RUN_EMAIL=ton.email@gmail.com
```

---

## Hors scope MVP (ne PAS implémenter aujourd'hui)

- ❌ Mémoire entre runs (ne pas répéter les news d'il y a 1-2 semaines)
- ❌ Désinscription en 1 clic (token, route /unsubscribe)
- ❌ Personnalisation par rôle (product eng / SEO / founder / …)
- ❌ Tiering free / pro / payant
- ❌ Page d'archives publique
- ❌ Auth des abonnés, double opt-in
- ❌ Open rate tracking, click tracking, analytics
- ❌ A/B test du sujet
- ❌ Tests unitaires / e2e
- ❌ Theme dark
- ❌ proxy.ts (rate limit, redirects)

Tout ça arrive après les 30-50 premiers abonnés actifs. Avant, c'est du
gold plating.

---

## Ordre d'exécution recommandé pour Claude Code

Faire P1 → P2 → P3 → **STOP, validation utilisateur** (lire le brief généré
en dry-run, ajuster le prompt si nécessaire).

Puis P4 → P5 → **STOP, validation utilisateur** (test inscription end-to-end).

Puis P6 (manuel, instructions à suivre par l'humain, pas Claude Code).

À chaque "STOP", **ne pas continuer sans confirmation explicite**.
