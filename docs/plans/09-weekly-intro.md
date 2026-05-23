# PLAN_9.md — Intro éditoriale hebdomadaire

**Version:** 1.0
**Date:** 22 mai 2026
**Portée:** ajouter un paragraphe d'intro LLM en tête de la newsletter du lundi,
généré à partir des articles sélectionnés pour la semaine.
**À lire avec:** CONVENTIONS.md (priorité en cas de conflit).

---

## 1. Ce qui change

**`scripts/weekly.ts`**
- Après la sélection des top N articles (étape 2), appel Claude Sonnet avec
  les titres + résumés + catégories de la semaine.
- L'intro générée est passée à `sendBriefToList()` via `composeBrief()`.
- **Fail gracefully** : si l'appel échoue ou si `ANTHROPIC_API_KEY` manque,
  le brief part sans intro (log `[weekly] intro skipped: <raison>`, run = succès).
- **DRY_RUN** : affiche l'intro générée dans le terminal avant les articles.
- Logguer les tokens (CONVENTIONS §Appels LLM règle 3 : "Logguer les usages").

**`lib/email.ts`**
- `buildNewsletterMarkdown(bodyMarkdown, unsubscribeUrl, subject, intro?)` :
  si `intro` est fourni, l'insérer après le `---` du wordmark et avant la liste.

---

## 2. Prompt

Variante hebdomadaire de `INTRO_PROMPT` de `lib/writer.ts`. Même contrat :

- **Source-only** : ne référencer que les articles fournis, pas la mémoire du modèle.
- ~80-100 mots, ton direct builder-to-builder.
- Pas d'opener "Here's what happened this week" ni de résumé exhaustif.
- Angle semaine : mettre en relief 1-2 thèmes transversaux ou contrastes notables
  (ex : "deux releases infra majeures + un paper sur les architectures d'agents").
- Même contrainte ponctuation : jamais de `—`/`–`. Virgules, points, parenthèses.
- Modèle : `claude-sonnet-4-6` (CONVENTIONS §Pipeline règle 9).

---

## 3. Coût

Un seul appel par envoi (~800 tokens in / ~150 out ≈ 0,003 $). Non bloquant.

---

## 4. Toi vs Claude Code

**Toi :** rien — tout est automatisable.

**Claude Code :**
1. Ajouter `WEEKLY_INTRO_PROMPT` dans `scripts/weekly.ts`.
2. Appel Anthropic après la sélection, avant la composition. Fail gracefully.
3. Mettre à jour `buildNewsletterMarkdown()` dans `lib/email.ts`.
4. DRY_RUN affiche l'intro. Logs tokens.

**Commit :** `feat(weekly): generate editorial intro with claude sonnet`
