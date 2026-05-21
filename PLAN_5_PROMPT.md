# PLAN_5_PROMPT.md — Prompt d'exécution pour Claude Code

> À coller dans Claude Code pour implémenter PLAN_5 (étape de sélection
> éditoriale). Lire PLAN_5.md et CONVENTIONS.md d'abord.

---

```
Contexte : on ajoute une étape de "sélection éditoriale" au pipeline quotidien
(scripts/daily.ts), entre l'enrich et le writer. Elle réduit le panier d'articles à
écrire à un maximum de 8, en ne gardant que ce qui passe le filtre wwwatch :
"est-ce que ça change ce qu'un product engineer va builder, shipper ou décider cette
semaine ?". Spécification complète : PLAN_5.md. Lis PLAN_5.md ET CONVENTIONS.md avant
de coder.

IMPORTANT — lib/prompt.ts n'existe plus. L'ancien fichier (prompt du brief hebdo en
français) a été supprimé car obsolète. Il faut le recréer. Mais NE recrée PAS l'ancien
contenu : on crée un nouveau lib/prompt.ts qui contient le prompt de sélection décrit
plus bas.

Rappel ponctuation (CONVENTIONS) : n'introduis aucun "—" (em dash) ni "–" (en dash)
dans le code, les chaînes, ni les exemples de "reason". Points, virgules, parenthèses.

═══════════════════════════════════════════════════════════════
PHASE 0 — Inspection (avant d'écrire quoi que ce soit)
═══════════════════════════════════════════════════════════════
Lis le code actuel pour comprendre l'état réel, et reporte ce que tu trouves :
1. scripts/daily.ts : l'ordre des étapes, comment l'enrich passe ses résultats au
   writer, le type des items enrichis (nom du type, champs disponibles, notamment le
   contenu enrichi et l'ID).
2. lib/enrich.ts : que retourne exactement l'enrich (forme des EnrichedItem).
3. lib/writer.ts : OÙ vivent actuellement les prompts du writer et de l'intro
   (inlinés ici ? ailleurs ?). NE LES DÉPLACE PAS, NE LES REFACTORE PAS. On veut juste
   savoir où ils sont pour ne rien casser (CONVENTIONS règle Claude Code 8 : pas de
   refacto au passage).

Si les prompts writer/intro sont inlinés dans writer.ts, laisse-les là. lib/prompt.ts
ne contiendra QUE le prompt de sélection pour l'instant. (Centraliser tous les prompts
est hors scope ; si tu penses que ce serait mieux, note-le dans FUTURE.md, ne le fais
pas.)

Reporte le résultat de l'inspection avant de passer à la Phase 1.

═══════════════════════════════════════════════════════════════
PHASE 1 — lib/prompt.ts (recréation, prompt de sélection uniquement)
═══════════════════════════════════════════════════════════════
Crée lib/prompt.ts exportant :

  export function buildSelectionPrompt(candidates: SelectionCandidate[]): string

où SelectionCandidate est défini dans lib/selector.ts (Phase 2) et importé, ou
co-localisé — choisis le plus simple, commente ton choix.

Le prompt produit est en ANGLAIS (cohérent avec le reste de la génération). Il doit
contenir, dans cet esprit (reformule proprement, ne copie pas mot à mot si tu fais
mieux, mais garde TOUTES les contraintes) :

---
You are the editor of wwwatch, a daily brief on AI tooling for product engineers.

From the candidate items below, keep only the ones that change what a product engineer
would build, ship, or decide this week. Be ruthless. The value of wwwatch is what it
leaves out.

KEEP items like:
- a model release that expands what you can actually run or build
- a security incident in infrastructure many builders depend on
- a funding, IPO, or acquisition event for a vendor builders rely on
- a new evaluation or benchmark that changes how you compare tools
- a genuine, substantive point of view on building with agents

DROP items like:
- a routine patch, hotfix, or alpha release of a niche repository
- a changelog whose headline is "fixes crashes" or "bug fixes"
- a tool outside the reader's ecosystem, or in a language/platform they do not use
- a popular repository with no actual event this week
- memes, screenshots, opinions with no concrete development

Select AT MOST 8. Select FEWER if fewer genuinely qualify. Never pad the list to reach
a number. A short, true edition beats a padded one.

Return STRICT JSON, no preamble, no markdown fences:
{
  "selected": [ { "id": "<id>", "reason": "<one short line>" } ],
  "dropped":  [ { "id": "<id>", "reason": "<one short line>" } ]
}
Order "selected" strongest first. Keep each reason to one short line. Do not use em
dashes or en dashes in reasons.

CANDIDATES:
<for each candidate: id, title, source, category, snippet>
---

═══════════════════════════════════════════════════════════════
PHASE 2 — lib/selector.ts
═══════════════════════════════════════════════════════════════
Crée lib/selector.ts :

  type SelectionCandidate = {
    id: string;
    title: string;
    source: string;
    category: string;
    snippet: string;     // ~350 premiers chars du contenu enrichi
  };

  type SelectionResult = {
    selected: { id: string; reason: string }[];
    dropped:  { id: string; reason: string }[];
  };

  export async function selectEditorial(
    enriched: <type réel des items enrichis, vu en Phase 0>
  ): Promise<SelectionResult>

Comportement :
- Construire les SelectionCandidate depuis les items enrichis. snippet = environ 350
  premiers caractères du contenu enrichi (pas tout le contenu : appel léger).
- UN appel Anthropic, modèle claude-sonnet-4-6 (CONVENTIONS : modèle pinné, pas Haiku).
- Parser la sortie JSON DÉFENSIVEMENT (sortie LLM = donnée non fiable) :
  * Strip d'éventuelles fences ```json avant parse.
  * GARDE-FOU 1 : ignorer tout id renvoyé qui n'était pas dans l'entrée (intersection
    avec les IDs réels des candidats).
  * GARDE-FOU 2 : appliquer le plafond EN CODE. Si "selected" dépasse 8 après
    nettoyage, ne garder que les 8 premiers. Le plafond ne dépend pas du modèle.
  * GARDE-FOU 3 : 0 sélectionné est autorisé (jour calme). Logguer un warning :
    [selector] 0 items selected — quiet day, edition will be near-empty
  * FALLBACK : si le JSON est inparsable, NE PAS planter le run. Logguer
    [selector] parse failed, fell back to top-6 by score
    et retourner les 6 meilleurs par score comme "selected" (raison = "fallback: top by score").
- Logs (CONVENTIONS : préfixe [selector]) :
    [selector] N candidates → K selected, M dropped (cap 8)
    puis une ligne "keep <id> — <reason>" et "drop <id> — <reason>" par décision.
- Pas de any. Pas de non-null assertion sur la clé API : check + throw si manquante
  (fail fast).

═══════════════════════════════════════════════════════════════
PHASE 3 — Branchement dans scripts/daily.ts
═══════════════════════════════════════════════════════════════
- Insérer selectEditorial ENTRE l'enrich et le writer.
- Le writer ne reçoit QUE les items dont l'id est dans result.selected (préserver
  l'ordre du classement de la sélection).
- Respecter le flag DRY_RUN : en dry-run, exécuter la sélection et logguer le résultat,
  sans écrire en DB (comme le reste du pipeline en dry-run).
- Mettre à jour le log de fin de run pour refléter le nombre d'articles réellement
  écrits (≤8) au lieu de 18.

═══════════════════════════════════════════════════════════════
CONTRAINTES
═══════════════════════════════════════════════════════════════
- Strictement : créer lib/prompt.ts (sélection), lib/selector.ts, et brancher dans
  daily.ts. AUCUNE autre modification. Ne touche pas à enrich.ts ni writer.ts au-delà
  de ce qui est nécessaire pour passer le panier filtré (idéalement : rien dans
  enrich.ts, et dans writer.ts juste l'entrée qui change).
- Pas de refacto des prompts existants writer/intro (règle 8).
- TypeScript strict, pas de any, parsing défensif, logs préfixés.
- claude-sonnet-4-6 pour l'appel de sélection.
- Vérifie avant commit : grep -n "—\|–" lib/prompt.ts lib/selector.ts ne retourne rien.
- npm run build doit passer.
- Un seul commit : feat(pipeline): add editorial selection step (cap 8, no floor)

═══════════════════════════════════════════════════════════════
DONE QUAND
═══════════════════════════════════════════════════════════════
- lib/prompt.ts recréé, contient buildSelectionPrompt (sélection uniquement).
- lib/selector.ts : selectEditorial avec les 3 garde-fous + fallback top-6.
- daily.ts : sélection branchée entre enrich et writer, writer ne reçoit que les ≤8
  sélectionnés.
- Un dry-run sur 2026-05-21 écrit environ 6 à 8 articles (pas 18), la traîne
  (ruflo-alpha, cherry-studio, cowagent, aionui, copilotkit-patch, cua-driver,
  activepieces, distributed-systems-testing) N'est PAS écrite, et les vraies stories
  (IPO, breach GitHub, Ollama, Unsloth, géométrie, OpenCompass, Grok, backpressure)
  survivent. Les logs [selector] montrent les raisons de garde/jet.
- build OK, pas de dashes interdits.

Après le dry-run : ne fige rien dans PLAN_3/CONVENTIONS. Reporte la liste gardée/jetée
avec les raisons, pour validation humaine du jugement avant de continuer.
```

---

## Note pour toi (pas pour Claude Code)

Deux choses à surveiller au dry-run de Phase 3, parce que ce sont les seuls
points où le sélecteur peut mal juger :

1. **Le snippet à 350 chars.** Suffisant pour jeter les changelogs
   évidents, mais sur un cas limite le sélecteur juge sur un extrait. S'il
   jette une vraie story par manque de contexte, augmente le snippet (ne
   touche pas au code, juste la taille).

2. **Le fallback top-6 par score.** S'il se déclenche (parse JSON échoué),
   tu retombes sur le score brut, donc potentiellement sur la traîne qu'on
   veut éviter. Ce n'est qu'un filet de sécurité, mais si tu le vois dans
   les logs plus d'une fois, le vrai problème est le parsing, pas la
   sélection — à investiguer.

Et comme d'habitude : ne fige l'étape dans PLAN_3 et CONVENTIONS
qu'**après** avoir lu une édition sélectionnée propre. Le prompt le dit à
Claude Code, mais c'est à toi de faire la validation finale du jugement.
