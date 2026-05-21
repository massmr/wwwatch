---
name: wwwatch build state
description: Current implementation status of the wwwatch daily AI journal pipeline
type: project
---

**Toutes les phases PLAN_3 sont complètes (commit 8ab0672 + redeploy).**

**Why:** PLAN_3 visait à remplacer la génération à la volée par un pipeline CLI déterministe. Objectif atteint.

**How to apply:** Référence uniquement pour les prochaines features ou bugfixes.

## État final (2026-05-21)

| Phase | Status | Résumé |
|---|---|---|
| 0 — Correctifs + traduction | ✅ | EN-only, deps, scripts |
| 1 — Schema DB | ✅ | 5 tables Neon live (editions, articles, raw_items, subscribers, briefs) |
| 2 — Collectors | ✅ | HN, GitHub, HF, Reddit, RSS (Promise.allSettled, URL dedup) |
| 3 — Pipeline v3.1 | ✅ | event_freshness scoring, source-material fetch, writer contraint, editor flags |
| 4 — Pipeline prod | ✅ | scripts/daily.ts (6 étapes) + scripts/publish.ts |
| 5 — Rendu | ✅ | /, /journal, /journal/[date], /journal/[date]/[slug], /about, /today |
| 6 — Cron + deploy | ✅ | Live wwwatch.dev, GH Actions daily/weekly, Next.js 16.2.6 |
| 7 — Hebdo | ✅ | scripts/weekly.ts (zero LLM, summaries → markdown → Resend) |

## Architecture

- Pipeline CLI (scripts/daily.ts) → Neon DB → Next.js lit la DB (jamais de LLM dans le chemin web)
- Cron GH Actions : daily 06:00 UTC, weekly lundi 07:00 UTC
- Deploy hook Vercel configuré dans .env.local (VERCEL_DEPLOY_HOOK_URL)

## Prochaines étapes possibles

- Ajouter les GitHub Secrets (ANTHROPIC_API_KEY, DATABASE_URL) pour que le cron tourne
- Configurer le deploy hook comme GitHub Secret aussi
- Phase future : améliorer scoring GitHub (events détectés depuis releases API), ajouter sources RSS manquantes (Anthropic, DeepMind)
