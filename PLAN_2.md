# Prompt pour créer PLAN_2.md

Tu vas créer un document PLAN_2.md qui documente l'état actuel du projet wwwatch et les prochaines phases d'implémentation.

---

## Contexte du projet

**wwwatch** est une newsletter hebdomadaire de veille IA pour product engineers, envoyée chaque lundi matin.

### Décisions architecturales prises

1. **Stack technique** :
   - Next.js 16 (app router)
   - Neon Postgres (free tier, 0.5GB)
   - React Email pour les templates
   - Anthropic Claude API (Sonnet 4.6)
   - Resend pour l'envoi d'emails
   - Vercel pour l'hosting
   - GitHub Actions pour le cron

2. **Génération du brief** :
   - Prompt Version B : "structure guidée" avec flexibilité adaptative
   - Recherche web via `web_search` tool (10-20 recherches dynamiques)
   - Système de fallback vers collecteurs RSS/API si web_search timeout
   - Output : markdown stylé, 500-900 mots

3. **Template email** :
   - React Email avec composants modulaires
   - Header fixe : "⚡ wwwatch - Veille IA pour product engineers"
   - Footer avec lien unsubscribe
   - Styling inline compatible tous clients mail

4. **Coûts** :
   - Claude Sonnet 4.6 + web_search : ~$0.13/brief = $6.76/an
   - Fallback collecteurs : ~$0.08/brief = $4.16/an
   - Resend : gratuit (3000 emails/mois)
   - Neon : gratuit (0.5GB)
   - Vercel : gratuit
   - **Total : $4-7/an**

---

## Fichiers déjà créés

```
wwwatch/
├── emails/
│   ├── weekly-brief.tsx              # Template React Email principal
│   └── components/
│       ├── header.tsx                # Header "⚡ wwwatch"
│       ├── footer.tsx                # Footer avec unsubscribe
│       └── content.tsx               # Rendu markdown → HTML
├── lib/
│   ├── prompt.ts                     # Prompt Version B (structure guidée)
│   └── email.ts                      # sendBriefToList() avec React Email
├── package.json                       # Deps installées
├── tsconfig.json                      # Config TypeScript
├── FALLBACK_IMPLEMENTATION.md         # Doc du système de fallback
├── REACT_EMAIL_SETUP.md               # Doc React Email
└── CONVENTIONS.md                     # Règles de dev (TypeScript strict, etc.)
```

**Fichiers manquants (à créer)** :
- `lib/research.ts` : génération du brief via Claude API
- `lib/db.ts` : connexion Neon + queries subscribers/briefs
- `scripts/brief.ts` : orchestrateur CLI (dry run, prod)
- `app/page.tsx` : landing page avec formulaire subscribe
- `app/api/subscribe/route.ts` : API route pour inscription
- `app/unsubscribe/page.tsx` : page de désabonnement
- `schema.sql` : schéma DB Neon
- `.github/workflows/weekly-brief.yml` : cron GitHub Actions

---

## Ce que PLAN_2.md doit contenir

### 1. Vue d'ensemble du projet

- Pitch en 2 phrases
- Public cible
- Proposition de valeur
- Différenciateur vs TLDR AI, Import AI

### 2. Architecture technique complète

**Diagramme de flux** (en ASCII art ou markdown) :
```
Landing page → Subscribe → Neon DB
                              ↓
               GitHub Actions cron (lundi 6am UTC)
                              ↓
               scripts/brief.ts orchestrator
                              ↓
               lib/research.ts:
                 - Try web_search (Claude Sonnet 4.6)
                 - Fallback collectors si timeout
                              ↓
               lib/email.ts:
                 - render(<WeeklyBrief />) via React Email
                 - sendBriefToList() via Resend
                              ↓
               Subscribers reçoivent le brief
```

**Stack détaillée** :
- Frontend : Next.js 16, React 19, SCSS Modules
- Backend : Next.js API routes, Server Actions
- Database : Neon Postgres (serverless)
- Email : React Email + Resend
- AI : Anthropic Claude Sonnet 4.6
- Hosting : Vercel (frontend + API)
- CI/CD : GitHub Actions

### 3. Schéma de base de données

```sql
-- Table subscribers
CREATE TABLE subscribers (
  email VARCHAR(255) PRIMARY KEY,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_subscribers_active ON subscribers(active);

-- Table briefs (historique)
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

### 4. Phases d'implémentation

Détaille 6 phases MVP avec critères d'acceptance clairs.

**Phase 1 : Setup Next.js + DB**
- Init Next.js 16 avec app router
- Configurer Neon DB
- Créer schema.sql et migrer
- Implémenter lib/db.ts (connexion + queries)
- **Acceptance** : `SELECT * FROM subscribers` retourne []

**Phase 2 : Génération du brief (avec STOP pour validation)**
- Implémenter lib/research.ts avec web_search
- Implémenter fallback collecteurs (si temps)
- Script CLI : scripts/brief.ts avec flag --dry
- **STOP OBLIGATOIRE** : générer 2-3 briefs, valider qualité avant de continuer
- **Acceptance** : `npm run brief:dry` génère un brief et l'envoie à DRY_RUN_EMAIL

**Phase 3 : Landing page + Subscribe**
- Créer app/page.tsx (formulaire simple)
- Créer app/api/subscribe/route.ts (Server Action)
- Créer app/unsubscribe/page.tsx
- Styling SCSS minimal
- **Acceptance** : s'inscrire via la landing → email apparaît dans DB

**Phase 4 : Email React template (FAIT)**
- ✅ Template React Email créé
- ✅ Header/Footer/Content components
- ✅ lib/email.ts avec render()
- **Acceptance** : `npm run email:dev` affiche le template

**Phase 5 : CI/CD GitHub Actions**
- Créer .github/workflows/weekly-brief.yml
- Cron : lundi 6am UTC
- Secrets : ANTHROPIC_API_KEY, RESEND_API_KEY, DATABASE_URL
- **Acceptance** : déclencher manuellement le workflow → brief envoyé

**Phase 6 : Deploy Vercel + monitoring**
- Deploy sur Vercel
- Configurer domaine wwwatch.dev
- Configurer env vars Vercel
- Setup Resend analytics
- **Acceptance** : visiter wwwatch.dev → landing visible, s'inscrire fonctionne

### 5. Variables d'environnement

Liste complète des env vars requises :

**Development (.env.local)** :
```env
# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Neon DB
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

# Resend
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=brief@wwwatch.dev

# Dry run
DRY_RUN_EMAIL=ton@email.com
```

**Production (Vercel)** :
- Mêmes vars sauf DRY_RUN_EMAIL

### 6. Coûts détaillés

Tableau avec breakdown :

| Service | Free tier | Coût estimé | Notes |
|---------|-----------|-------------|-------|
| Claude Sonnet 4.6 | N/A | $6.76/an | 52 briefs × $0.13 |
| Fallback collecteurs | N/A | $4.16/an | Si web_search fail |
| Resend | 3000/mois | $0 | Largement suffisant |
| Neon DB | 0.5GB | $0 | < 10k subscribers |
| Vercel | Hobby plan | $0 | Static + API routes |
| GitHub Actions | 2000 min/mois | $0 | Cron = ~5min/semaine |
| **Total** | - | **$4-7/an** | Selon fallback usage |

**Scaling** :
- 1k subscribers : $0/an (reste free tier)
- 10k subscribers : $0/an (toujours free tier)
- 100k subscribers : $19/mois Resend + $25/mois Neon = $528/an

### 7. Prompt Version B (résumé)

Résumé en 1 paragraphe de la philosophie du prompt :
- Structure guidée mais flexible
- Recherche dynamique (pas de script fixe)
- Adapte le contenu selon l'actu
- Ton direct product engineer → product engineer
- Anti-hallucination strict (URLs vérifiées)
- Interdictions explicites (pas de meta-commentaires, liens cliquables)

### 8. Système de fallback (résumé)

Résumé en 1 paragraphe :
- web_search = méthode primaire (incrémental, adaptatif)
- Fallback automatique vers collecteurs si timeout
- 5 collecteurs : HN (Algolia), HF (Daily Papers), GitHub (Trending), arXiv, TLDR AI (scraping)
- Fail-safe : si un collecteur échoue, les autres continuent
- Flags CLI : --websearch (force), --direct (skip web_search)

### 9. Décisions techniques clés

Liste des décisions importantes avec justifications courtes :

**Neon vs Supabase** :
- Neon choisi car drop-in Postgres, free tier 0.5GB
- Supabase épuisé (limite projets gratuits)

**Claude Sonnet vs Opus** :
- Sonnet = $0.13/brief vs Opus $0.21/brief
- 40% moins cher, qualité suffisante pour MVP

**React Email vs HTML custom** :
- React Email = code maintenable, preview en dev
- Compile vers HTML inline automatiquement

**Resend vs SendGrid** :
- Resend = meilleure DX, support React Email natif
- Free tier 3000/mois vs SendGrid 100/jour

### 10. Contraintes et limitations MVP

**Ce qui est inclus dans le MVP** :
- Brief hebdo product engineers uniquement
- 1 template email fixe
- Subscribe/unsubscribe basique
- Génération automatique chaque lundi

**Ce qui est hors scope MVP** :
- Multi-profils (Instagram creator, backend engineer, etc.)
- Personnalisation par user
- Analytics détaillées (open rate, click rate)
- Interface admin pour éditer les briefs
- Archive web des anciens briefs
- Recommandations personnalisées

**Post-MVP** (v2) :
- Multi-profils dynamiques
- User preferences (fréquence, catégories)
- Archive searchable sur le site
- Metrics dashboard
- Monétisation (sponsoring, tier payant)

### 11. Testing strategy

**Testing manuel** :
- Phase 2 : générer 2-3 briefs, valider qualité/ton
- Phase 3 : tester subscribe/unsubscribe flow
- Phase 5 : déclencher cron manuellement

**Testing automatisé** (post-MVP) :
- Unit tests : lib/research.ts, lib/db.ts
- Integration tests : API routes
- E2E tests : subscribe flow

### 12. Monitoring et observabilité

**MVP** :
- Logs Vercel (API routes, cron)
- Logs GitHub Actions (cron execution)
- Resend dashboard (delivery, bounces)

**Post-MVP** :
- Sentry pour error tracking
- PostHog pour product analytics
- Mixpanel pour email engagement

### 13. Prochaines étapes immédiates

Liste les 3 prochaines actions concrètes :

1. **Implémenter lib/research.ts** :
   - Fonction generateBriefMarkdown()
   - Appel Claude API avec web_search tool
   - Utiliser buildPrompt() de lib/prompt.ts
   - Gestion d'erreur et timeout

2. **Implémenter lib/db.ts** :
   - Connexion Neon via @neondatabase/serverless
   - Fonctions : getActiveSubscribers(), logBrief(), addSubscriber()
   - Error handling avec try/catch

3. **Créer scripts/brief.ts** :
   - CLI orchestrator avec args --dry, --websearch, --direct
   - Appelle generateBriefMarkdown()
   - Appelle sendBriefToList()
   - Logs clairs pour debug

### 14. Références et ressources

Liste des docs utiles :
- Next.js 16 docs : https://nextjs.org/docs
- React Email docs : https://react.email/docs
- Neon docs : https://neon.tech/docs
- Anthropic API docs : https://docs.anthropic.com
- Resend docs : https://resend.com/docs

---

## Format du document PLAN_2.md

Structure markdown propre avec :
- Table des matières en haut
- Headers hiérarchisés (# ## ###)
- Code blocks avec syntax highlighting
- Tables markdown pour les comparaisons
- Diagrammes ASCII art pour les flows
- Emojis pour les sections (📦 🚀 ⚠️ ✅)

---

## Ton du document

- **Précis** : specs claires, pas d'ambiguïté
- **Actionnable** : chaque phase a des critères d'acceptance
- **Pragmatique** : focus sur le MVP, pas de over-engineering
- **Pédagogique** : explique les décisions techniques

---

Crée maintenant PLAN_2.md en suivant cette structure.
