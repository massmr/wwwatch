# PLAN_2.md — wwwatch MVP

**Version:** 2.1  
**Date:** 20 mai 2026  
**Status:** Phases partiellement complètes (détails ci-dessous)

---

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [État actuel](#état-actuel)
3. [Architecture technique](#architecture-technique)
4. [Schéma de base de données](#schéma-de-base-de-données)
5. [Phases d'implémentation](#phases-dimplémentation)
6. [Variables d'environnement](#variables-denvironnement)
7. [Coûts détaillés](#coûts-détaillés)
8. [Prompt Version B](#prompt-version-b)
9. [Système de fallback](#système-de-fallback)
10. [Décisions techniques](#décisions-techniques)
11. [Contraintes MVP](#contraintes-mvp)
12. [Testing](#testing-strategy)
13. [Monitoring](#monitoring-et-observabilité)
14. [Prochaines étapes](#prochaines-étapes-immédiates)
15. [Références](#références-et-ressources)

---

## Vue d'ensemble

### Pitch

**wwwatch** est une newsletter hebdomadaire de veille IA, envoyée chaque lundi matin, qui filtre le bruit pour ne garder que ce qui impacte vraiment la stack d'un product engineer.

### Public cible

Product engineers qui codent avec des LLMs au quotidien. Ils ont besoin de savoir :
- Quels modèles viennent de sortir (et s'ils doivent upgrade)
- Quels outils/frameworks méritent d'être testés
- Quels papers ont un impact pratique
- Quelles levées/acquisitions changent le marché

### Proposition de valeur

**Signal vs bruit.** Contrairement à TLDR AI (généraliste tech) ou Import AI (académique), wwwatch se concentre exclusivement sur ce qui change ta stack cette semaine.

**Format court.** 500-900 mots, 5 minutes de lecture, envoyé le lundi matin. Pas de newsletter de 3000 mots qu'on ne lit jamais.

**Ton direct.** Product engineer → product engineer. Pas de corporate speak, pas de hype.

### Différenciateur

| Critère | wwwatch | TLDR AI | Import AI |
|---------|---------|---------|-----------|
| Focus | Product engineering | Tech généraliste | Research ML |
| Longueur | 500-900 mots | 1500+ mots | 2000+ mots |
| Fréquence | Hebdo (lundi) | Quotidien | Hebdo (dimanche) |
| Ton | Direct, pratique | Neutre, factuel | Académique |
| Coût | Gratuit | Gratuit | Gratuit |

---

## État actuel

### ✅ Fichiers créés (React Email templates)

```
wwwatch/
├── emails/                            # Templates React Email
│   ├── weekly-brief.tsx              # Template principal
│   └── components/
│       ├── header.tsx                # Header "⚡ wwwatch"
│       ├── footer.tsx                # Footer avec unsubscribe
│       └── content.tsx               # Rendu markdown → HTML
├── lib/
│   └── prompt.ts                     # Prompt Version B (structure guidée)
├── package.json                       # Deps: @react-email/components
├── tsconfig.json                      # Config TypeScript
├── FALLBACK_IMPLEMENTATION.md         # Doc système de fallback
├── REACT_EMAIL_SETUP.md               # Doc React Email
└── CONVENTIONS.md                     # Règles de dev
```

### ✅ Fichiers créés (Claude Code — commit feat(plan2))

```
wwwatch/
├── lib/
│   ├── research.ts                   # Génération brief (Claude Sonnet 4.6)
│   ├── db.ts                         # Connexion Neon + queries
│   └── email.ts                      # Email sending (marked, sans React Email)
├── app/
│   └── unsubscribe/
│       ├── page.tsx                  # Page désabonnement + HMAC validation
│       └── page.module.scss          # Styles minimalistes
└── .env.example                       # SITE_URL + UNSUBSCRIBE_SECRET
```

### ⚠️ Conflit à résoudre

**`lib/email.ts`** existe en 2 versions :
- **Version React Email** (PLAN_2) : utilise `render(<WeeklyBrief />)`
- **Version Claude Code** : utilise `marked.parse()` directement

**→ À merger** : combiner React Email + HMAC signed links (voir section Prochaines étapes)

### ❌ Fichiers manquants

```
wwwatch/
├── schema.sql                         # Schéma DB Neon
├── scripts/
│   └── brief.ts                      # Orchestrateur CLI
├── app/
│   ├── page.tsx                      # Landing page
│   ├── api/subscribe/route.ts        # API route inscription
│   └── styles/                       # Styles globaux et landing
└── .github/workflows/
    └── weekly-brief.yml              # Cron GitHub Actions
```

---

## Architecture technique

### Diagramme de flux

```
┌─────────────────────────────────────────────────────────┐
│ Landing page (Next.js)                                  │
│ ↓ User entre son email                                  │
│ ↓ Server Action: subscribe()                            │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│ Neon Postgres DB                                        │
│ → Table subscribers (email, status, created_at...)      │
│ → Table briefs (historique)                             │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│ GitHub Actions Cron                                     │
│ → Chaque lundi 6am UTC                                  │
│ → Déclenche: scripts/brief.ts                           │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│ scripts/brief.ts (orchestrateur)                        │
│ → Flags: --dry, --websearch, --direct                  │
│ → Appelle lib/research.ts                               │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│ lib/research.ts (génération brief)                      │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ PRIMARY: Claude Sonnet 4.6 + web_search             │ │
│ │ → 10-20 recherches dynamiques                       │ │
│ │ → Timeout 120s                                      │ │
│ └──────────────────┬──────────────────────────────────┘ │
│                    ↓ (timeout/error)                     │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ FALLBACK: Collecteurs RSS/API                       │ │
│ │ → HN, HF, GitHub, arXiv, TLDR                       │ │
│ └──────────────────┬──────────────────────────────────┘ │
└────────────────────┼────────────────────────────────────┘
                     ↓
                Markdown brief généré
                     ↓
┌─────────────────────────────────────────────────────────┐
│ lib/email.ts (rendu + envoi)                            │
│ → render(<WeeklyBrief />) via React Email               │
│ → buildUnsubscribeUrl(email) avec HMAC-SHA256           │
│ → sendBriefToList() via Resend                          │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│ Email HTML stylé + HMAC signed unsubscribe              │
│ → Header: "⚡ wwwatch"                                  │
│ → Content: markdown → HTML stylé                        │
│ → Footer: lien unsubscribe signé                        │
└────────────────────┬────────────────────────────────────┘
                     ↓
              Subscribers reçoivent le brief
```

### Stack technique

| Couche | Technologie | Justification |
|--------|-------------|---------------|
| **Frontend** | Next.js 16 (app router) | Server Components, Server Actions |
| **Styling** | SCSS Modules | Scoped styles, tokens CSS |
| **Database** | Neon Postgres | Serverless, free tier 0.5GB |
| **Email template** | React Email | Composants → HTML inline, preview dev |
| **Email sending** | Resend | Free 3000/mois, support React Email |
| **AI** | Claude Sonnet 4.6 | $0.13/brief, web_search intégré |
| **Hosting** | Vercel | Free tier, CI/CD intégré |
| **CI/CD** | GitHub Actions | Free 2000 min/mois |

---

## Schéma de base de données

### Fichier: `schema.sql` (à créer)

```sql
-- Table subscribers
CREATE TABLE subscribers (
  email VARCHAR(255) PRIMARY KEY,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  unsubscribed_at TIMESTAMP
);

CREATE INDEX idx_subscribers_status ON subscribers(status);
CREATE INDEX idx_subscribers_created_at ON subscribers(created_at);

-- Table briefs (historique des envois)
CREATE TABLE briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  markdown TEXT NOT NULL,
  html TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  recipient_count INTEGER DEFAULT 0
);

CREATE INDEX idx_briefs_created_at ON briefs(created_at DESC);
```

**Note** : Claude Code a implémenté `deactivateSubscriber()` qui set `status='unsubscribed'` + `unsubscribed_at=NOW()`.

### Queries principales (déjà dans lib/db.ts)

```typescript
// Récupérer les abonnés actifs
getActiveSubscribers(): Promise<string[]>
// SELECT email FROM subscribers WHERE status = 'active'

// Désabonner un email
deactivateSubscriber(email: string): Promise<void>
// UPDATE subscribers SET status='unsubscribed', unsubscribed_at=NOW() WHERE email=$1

// Logger un brief envoyé
logBrief(data): Promise<void>
// INSERT INTO briefs (subject, markdown, html, recipient_count) VALUES (...)
```

---

## Phases d'implémentation

### Phase 1 : Setup Next.js + DB Neon ⚙️ **EN COURS**

**Objectif** : Bootstrapper le projet et connecter Neon DB.

**Status** :
- ✅ `lib/db.ts` créé (connexion + queries)
- ❌ `schema.sql` manquant
- ❌ Schéma pas exécuté sur Neon

**Tâches restantes** :
1. Créer `schema.sql` avec les tables
2. Se connecter à Neon console
3. Exécuter le schéma SQL
4. Tester connexion : `npm run db:test`

**Acceptance** :
```bash
node -e "import('./lib/db.js').then(db => db.getActiveSubscribers()).then(console.log)"
# Output: []
```

---

### Phase 2 : Génération du brief ⚙️ **EN COURS**

**Objectif** : Générer automatiquement le brief via Claude API.

**Status** :
- ✅ `lib/research.ts` créé (Claude Sonnet 4.6, web_search)
- ✅ `lib/prompt.ts` existe (Prompt Version B)
- ❌ `scripts/brief.ts` manquant (orchestrateur CLI)

**Tâches restantes** :
1. Créer `scripts/brief.ts` :
   - Flag `--dry` pour test
   - Flags `--websearch` / `--direct`
   - Appelle `generateBriefMarkdown()`
   - Appelle `sendBriefToList()`
   - Logs clairs (durée, tokens)
2. Tester génération : `npm run brief:dry`

**STOP OBLIGATOIRE** après création :
- Générer 2-3 briefs
- Valider qualité, ton, liens cliquables
- Valider pas de narration du processus

**Acceptance** :
```bash
npm run brief:dry
# Output:
# [research] web_search OK en 45s
# [brief] Sauvegardé dans out/2026-05-20.md
# [brief] Envoyé: 1, échoué: 0
```

---

### Phase 3 : Landing page + Subscribe ⚙️ **EN COURS**

**Objectif** : Créer la landing page avec formulaire d'inscription.

**Status** :
- ✅ `app/unsubscribe/page.tsx` créé (avec HMAC validation)
- ❌ `app/page.tsx` manquant (landing page)
- ❌ `app/api/subscribe/route.ts` manquant
- ❌ Styles globaux manquants

**Tâches restantes** :
1. Créer `app/page.tsx` :
   - Hero section avec value prop
   - Formulaire email simple
   - CTA clair
2. Créer `app/api/subscribe/route.ts` :
   - Validation email (regex)
   - Insertion DB
   - Rate limiting basique
3. Créer styles SCSS :
   - `app/styles/globals.scss`
   - `app/styles/landing.module.scss`

**Acceptance** :
1. Visiter `http://localhost:3000`
2. S'inscrire avec un email
3. Vérifier dans Neon : email présent, status='active'
4. Visiter `/unsubscribe`, vérifier status='unsubscribed'

---

### Phase 4 : Email React template ⚠️ **CONFLIT À RÉSOUDRE**

**Objectif** : Template email stylé avec React Email + HMAC signed links.

**Status** :
- ✅ Templates React Email créés (`emails/`)
- ✅ `lib/email.ts` version Claude Code (sans React Email, avec HMAC)
- ⚠️ **Conflit** : 2 versions de `lib/email.ts`

**Solution** : Merger les 2 versions
- ✅ Garde React Email `render(<WeeklyBrief />)`
- ✅ Garde HMAC `buildUnsubscribeUrl()` de Claude Code
- ✅ Personnalise l'unsubscribe URL par destinataire

**Tâches** :
1. Créer `lib/email.merged.ts` qui combine :
   - React Email rendering
   - HMAC signed unsubscribe links
   - Batching Resend
2. Tester : `npm run email:dev` (preview)
3. Tester : `npm run brief:dry` (envoi réel)

**Code à implémenter** :

```typescript
// lib/email.ts (version finale mergée)
import { Resend } from 'resend';
import { render } from '@react-email/components';
import { createHmac } from 'crypto';
import WeeklyBrief from '../emails/weekly-brief';

function buildUnsubscribeUrl(email: string): string {
  const secret = process.env.UNSUBSCRIBE_SECRET!;
  const token = createHmac('sha256', secret).update(email).digest('hex');
  const baseUrl = process.env.SITE_URL || 'https://wwwatch.dev';
  return `${baseUrl}/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
}

export async function sendBriefToList(
  emails: string[],
  markdown: string,
  subject: string
): Promise<{ sent: number; failed: number }> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  let sent = 0, failed = 0;

  for (let i = 0; i < emails.length; i += 100) {
    const batch = emails.slice(i, i + 100);
    try {
      for (const email of batch) {
        const html = render(
          WeeklyBrief({
            markdown,
            unsubscribeUrl: buildUnsubscribeUrl(email),
            previewText: subject,
          })
        );
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL!,
          to: email,
          subject,
          html,
        });
      }
      sent += batch.length;
    } catch (err) {
      console.error(`[email] Batch failed:`, err);
      failed += batch.length;
    }
  }
  return { sent, failed };
}
```

**Acceptance** :
```bash
npm run brief:dry
# Vérifier dans inbox :
# - Template stylé (React Email)
# - Lien unsubscribe signé HMAC
```

---

### Phase 5 : CI/CD GitHub Actions ❌ **PAS COMMENCÉ**

**Objectif** : Automatiser l'envoi hebdomadaire.

**Tâches** :
1. Créer `.github/workflows/weekly-brief.yml`
2. Cron : `0 6 * * 1` (lundi 6am UTC)
3. Steps : checkout, setup Node, install, run brief
4. Configurer secrets GitHub
5. Tester trigger manuel

**Acceptance** :
- Déclencher manuellement
- Vérifier logs : brief généré et envoyé
- Vérifier inbox : email reçu

---

### Phase 6 : Deploy Vercel ❌ **PAS COMMENCÉ**

**Objectif** : Déployer en production.

**Tâches** :
1. Connecter GitHub → Vercel
2. Configurer env vars Vercel
3. Configurer domaine `wwwatch.dev`
4. Tester en prod

**Acceptance** :
- Visiter `https://wwwatch.dev`
- S'inscrire
- Recevoir le brief le lundi suivant

---

## Variables d'environnement

### Development (`.env.local`)

```env
# Anthropic
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx

# Neon
DATABASE_URL=postgresql://user:pass@ep-xyz.us-east-2.aws.neon.tech/wwwatch?sslmode=require

# Resend
RESEND_API_KEY=re_xxxxx
RESEND_FROM_EMAIL=brief@wwwatch.dev

# Site (pour unsubscribe links)
SITE_URL=http://localhost:3000
UNSUBSCRIBE_SECRET=généré_avec_openssl_rand_hex_32

# Dry run test
DRY_RUN_EMAIL=ton@email.com
```

### Production (Vercel)

Mêmes variables (sauf `DRY_RUN_EMAIL`, remplacer `SITE_URL` par https://wwwatch.dev).

**Générer UNSUBSCRIBE_SECRET** :
```bash
openssl rand -hex 32
```

---

## Coûts détaillés

### Breakdown annuel (52 briefs/an)

| Service | Free tier | Coût/an | Notes |
|---------|-----------|---------|-------|
| **Claude Sonnet 4.6** | N/A | $6.76 | 52 × $0.13/brief |
| **Fallback collecteurs** | N/A | $4.16 | Si web_search timeout |
| **Resend** | 3000/mois | $0 | < 100/semaine |
| **Neon DB** | 0.5GB | $0 | < 10k subscribers |
| **Vercel** | Hobby | $0 | Static + API |
| **GitHub Actions** | 2000 min/mois | $0 | ~5 min/semaine |
| **Domaine** | N/A | $12 | Google Domains |
| **Total** | - | **$10-23** | Selon usage fallback |

### Scaling

**1k subscribers** : $10-23/an  
**10k subscribers** : $10-23/an  
**100k subscribers** : $550-563/an (Resend Pro + Neon Scale)

---

## Prompt Version B

### Philosophie

**Structure guidée** avec flexibilité adaptative.

**Principes** :
1. Recherche dynamique (10-20 searches, pas de script fixe)
2. Structure suggérée mais adaptable (skip sections si vide)
3. Ton explicite (exemples ✓ bon vs ✗ mauvais)
4. Anti-hallucination strict (URLs vérifiées)
5. Interdictions claires (max 2× "Pourquoi ça compte", liens cliquables)

**Fichier** : `lib/prompt.ts`

---

## Système de fallback

### Architecture

**PRIMARY** : Claude + web_search (adaptatif)  
**FALLBACK** : Collecteurs RSS/API (fiable 100%)

### Collecteurs

1. **Hacker News** (Algolia) : Top AI stories > 50 points
2. **Hugging Face** : Daily Papers API
3. **GitHub** : Trending AI repos
4. **arXiv** : cs.AI papers
5. **TLDR AI** : Scraping (bonus)

### Flags CLI

```bash
npm run brief:dry              # Auto (web_search + fallback)
npm run brief:dry -- --websearch  # Force web_search
npm run brief:dry -- --direct     # Force collecteurs
```

**Doc** : `FALLBACK_IMPLEMENTATION.md`

---

## Décisions techniques

### Neon vs Supabase
✅ Neon : free 0.5GB, drop-in Postgres, serverless

### Sonnet 4.6 vs Opus 4.7
✅ Sonnet : $0.13 vs $0.21 (40% moins cher), qualité suffisante

### React Email vs HTML custom
✅ React Email : maintenable, preview dev, compile inline auto

### Resend vs SendGrid
✅ Resend : free 3000/mois, meilleure DX, support React Email

---

## Contraintes MVP

### Inclus
✅ Brief hebdo product engineers  
✅ Template email fixe  
✅ Subscribe/unsubscribe  
✅ Génération auto (cron)  
✅ Système fallback  

### Hors scope MVP
❌ Multi-profils  
❌ Personnalisation user  
❌ Analytics détaillées  
❌ Interface admin  
❌ Archive web  

---

## Testing strategy

### Manuel (MVP)
- Phase 2 : valider 2-3 briefs générés
- Phase 3 : tester subscribe/unsubscribe
- Phase 5 : déclencher cron manuellement

### Automatisé (post-MVP)
- Unit tests : `lib/research.ts`, `lib/db.ts`
- Integration tests : API routes
- E2E tests : Playwright

---

## Monitoring et observabilité

### MVP (gratuit)
- Logs Vercel (API routes)
- Logs GitHub Actions (cron)
- Resend Dashboard (delivery rate)

### Post-MVP (payant)
- Sentry : error tracking
- PostHog : product analytics
- Mixpanel : email engagement

---

## Prochaines étapes immédiates

### 1. Merger `lib/email.ts` (React Email + HMAC)

**Priorité : CRITIQUE**

Créer la version finale qui combine :
- React Email `render(<WeeklyBrief />)`
- HMAC `buildUnsubscribeUrl(email)`
- Code fourni dans Phase 4 ci-dessus

**Test** :
```bash
npm run brief:dry
```

---

### 2. Créer `schema.sql` et exécuter sur Neon

**Fichier** : voir section Schéma de base de données

**Steps** :
1. Copier le SQL
2. Ouvrir Neon console
3. Exécuter le schéma SQL
4. Vérifier : `SELECT * FROM subscribers`

---

### 3. Créer `scripts/brief.ts`

**Responsabilités** :
- CLI avec flags `--dry`, `--websearch`, `--direct`
- Appelle `generateBriefMarkdown()`
- Save markdown dans `out/`
- Appelle `sendBriefToList()`

**Test** :
```bash
npm run brief:dry
```

---

## Références et ressources

- **Next.js 16** : https://nextjs.org/docs
- **React Email** : https://react.email/docs
- **Neon** : https://neon.tech/docs
- **Anthropic** : https://docs.anthropic.com
- **Resend** : https://resend.com/docs
- **Vercel** : https://vercel.com/docs

---

## Changelog

**v2.1** (20 mai 2026) :
- ✅ Intégration contributions Claude Code (research.ts, db.ts, unsubscribe)
- ⚠️ Conflit lib/email.ts identifié (React Email vs marked)
- 📋 Phases mises à jour avec status réel

**v2.0** (20 mai 2026) :
- ✅ Migration React Email
- ✅ Prompt Version B
- ✅ Système fallback documenté

**v1.0** (13 mai 2026) :
- 📝 Plan initial
