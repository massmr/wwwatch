# PLAN_5.md — Étape de sélection éditoriale

**Version:** 1.0
**Date:** 21 mai 2026
**Portée:** ajout d'une étape au pipeline quotidien, pas un nouveau chantier
**À lire avec:** PLAN_3.md (étapes 3-4) et CONVENTIONS.md (priorité en cas de conflit)

---

## 1. Le problème observé

Au dry-run du 21 mai, le pipeline a écrit **18 articles**, dont la moitié
étaient des release-notes de repos sans enjeu pour le lecteur :
`ruflo 3.7.0-alpha.33`, `cherry-studio v196 fixes crashes`, `cowagent
Feishu upgrade`, `copilotkit patch`, `aionui`, `cua-driver`…

Ces items sont factuellement corrects mais échouent au filtre éditorial de
wwwatch : **« est-ce que ça change ce que mon lecteur va builder cette
semaine ? »**. Un patch d'alpha d'un orchestrateur de niche → non.

Le scoring ne sait pas faire cette distinction : une release de routine et
une vraie news ont toutes deux de la fraîcheur événementielle et de
l'engagement repo, donc scorent haut. Le writer et la QA ne sont pas le
bon endroit pour trancher (la QA ne juge que le non-sourcé, pas la
pertinence — c'est correct, ce n'est pas son rôle).

**Il manque une étape de jugement éditorial entre le scoring et le
writer.**

---

## 2. Où elle se place, et pourquoi

```
collect → score (top 20) → enrich → ★ SÉLECTION ÉDITORIALE (≤8) ★ → write → QA → store(draft)
```

La sélection vient **après l'enrich** et **avant le writer**. Deux raisons :

1. **Juger sur du contenu réel, pas un titre.** On s'est fait piéger toute
   la soirée par le jugement-sur-titre (le writer qui brode, le titre brut
   GitHub). La sélection voit le contenu enrichi → décision fiable.
2. **Ne pas payer ce qu'on jette.** Le writer est le poste le plus cher
   (gros appels Sonnet rédactionnels : 27 780 in / 12 469 out pour 18
   articles au dernier run). Sélectionner avant le writer divise ce coût
   et le temps de run par ~2 (357s → ~150s attendus).

`publish.ts` **ne bouge pas**. Il reste la validation humaine
`draft → published`. La sélection automatique *propose* un panier resserré ;
l'humain *dispose* toujours. On ne mélange pas les deux rôles.

---

## 3. La règle de sélection

- **Plafond : 6-8 articles.** Jamais plus.
- **Pas de plancher.** Si seulement 4 items passent le filtre, on en garde
  4. Si 2, on en garde 2. Une édition courte et vraie bat une édition
  calibrée à un nombre. **Jamais de quota qui force à inclure du
  remplissage un jour pauvre.**
- **Filtre unique :** « est-ce que ça change ce qu'un product engineer va
  builder cette semaine ? » Si oui → garder. Si c'est un patch de routine,
  une alpha de niche, un changelog mineur, un projet hors écosystème du
  lecteur → écarter.

---

## 4. Contrat de l'étape (`lib/selector.ts`)

### Entrée

Les items enrichis (≤20 après les drops de l'enrich). Pour garder l'appel
**léger**, on ne passe PAS les 3000 chars de chaque item. On passe un
extrait compact par candidat :

```ts
type SelectionCandidate = {
  id: string;
  title: string;          // titre source
  source: string;         // ex 'github_trending', 'rss_openai'
  category: string;       // catégorie pressentie
  snippet: string;        // ~300-400 premiers chars du contenu enrichi
};
```

### Sortie (un appel Sonnet, `claude-sonnet-4-6`)

Sortie **structurée** (JSON), parsée défensivement (CONVENTIONS §Appels
LLM : sortie LLM = donnée non fiable). Le modèle renvoie un classement +
une raison courte par décision, pour l'observabilité :

```ts
type SelectionResult = {
  selected: { id: string; reason: string }[];   // ordonné, le plus fort d'abord
  dropped:  { id: string; reason: string }[];
};
```

### Garde-fous de parsing (dans le code, pas le prompt)

- **Intersection avec les IDs réels** : ignorer tout `id` renvoyé qui
  n'était pas dans l'entrée (le modèle peut halluciner un id).
- **Appliquer le plafond en code** : si le modèle renvoie >8 sélectionnés,
  ne garder que les 8 premiers du classement. Le plafond ne dépend pas de
  la bonne volonté du modèle.
- **Zéro sélectionné** : autorisé (jour très calme), mais loggué en warning
  `[selector] 0 items selected — quiet day, edition will be near-empty`,
  pour que l'humain le voie à la relecture.
- Si le parsing JSON échoue : ne pas planter le run. Logguer l'erreur et
  **fallback = garder les N=6 meilleurs par score** (dégradé mais sûr),
  avec log `[selector] parse failed, fell back to top-6 by score`.

### Log attendu

```
[selector] 18 candidates → 7 selected, 11 dropped (cap 8)
  keep  openai-confidential-ipo-filing — vendor your stack depends on goes public
  keep  github-unauthorized-access — supply-chain security, affects everyone
  ...
  drop  ruflo-3-7-0-alpha-33 — routine alpha patch, niche orchestrator
  drop  cherry-studio-v196 — crash fixes, no builder impact
```

Ce log est précieux : il te construit le **critère réel** au fil des
éditions (tu vois ce que le modèle garde/jette et pourquoi). À surveiller
les premières semaines.

---

## 5. Le prompt de sélection

Construit dans `lib/prompt.ts` (fonction dédiée, ex `buildSelectionPrompt`).
En anglais (cohérent avec le reste de la génération). Contraintes :

- Pose le filtre wwwatch explicitement : *"Keep only items that change what
  a product engineer would build, ship, or decide this week."*
- Donne des exemples de ce qu'on **garde** (model release that expands what
  you can run, a security incident in shared infra, a funding event for a
  vendor you depend on, a new eval, a genuine point of view on building
  agents) et de ce qu'on **écarte** (routine patch/alpha of a niche repo,
  crash-fix changelog, a tool outside the reader's ecosystem, a meme).
- **Cap explicite** : *"Select at most 8. Select fewer if fewer genuinely
  qualify. Never pad the list to reach a number."*
- Demande une sortie JSON stricte (pas de préambule, pas de markdown), avec
  `selected` et `dropped`, chacun `{id, reason}`, reason en une ligne.
- **Rappel ponctuation** (cf. CONVENTIONS) : pas de `—` ni `–` dans les
  `reason` générées.

---

## 6. Impact coût / temps

| | Avant (sans sélection) | Après (avec sélection) |
|---|---|---|
| Enrich | 20 items | 20 items (inchangé) |
| **Sélection** | — | 1 appel Sonnet léger (snippets) |
| Writer | 18 articles | ≤8 articles |
| Tokens writer | ~27k in / 12k out | ~½ |
| Temps run | ~357s | ~150-180s attendus |

L'appel de sélection est bon marché (snippets courts, une seule réponse
JSON). Le gain writer le rembourse largement.

---

## 7. Phases d'implémentation

### Phase 1 — Le sélecteur

- [ ] `lib/selector.ts` : `selectEditorial(candidates): Promise<SelectionResult>`.
  - Construit les `SelectionCandidate` (snippet = ~350 premiers chars du
    contenu enrichi).
  - Un appel `claude-sonnet-4-6`.
  - Parsing défensif + garde-fous §4 (intersection IDs, plafond en code,
    fallback top-6 par score si parse échoue).
- [ ] `lib/prompt.ts` : `buildSelectionPrompt(candidates)`.

### Phase 2 — Branchement dans `daily.ts`

- [ ] Insérer la sélection **entre enrich et writer**.
- [ ] Le writer ne reçoit que les `selected`.
- [ ] Logs `[selector]` (gardés + jetés + raisons).
- [ ] Flag `DRY_RUN` respecté (en dry-run, log la sélection sans écrire).

### Phase 3 — Vérification (dry-run)

- [ ] Relancer `daily` sur le 21 mai. Attendu : ~6-8 articles écrits au
  lieu de 18, la traîne (ruflo-alpha, cherry-studio, cowagent, aionui,
  copilotkit-patch, cua-driver, activepieces, distributed-systems) **n'est
  pas écrite**.
- [ ] Vérifier que les vraies stories survivent : IPO, breach GitHub,
  Ollama, Unsloth, géométrie, OpenCompass, Grok, le post backpressure.
- [ ] Lire les `reason` de drop : est-ce que le jugement tient ? Sinon,
  ajuster le prompt (pas le code).

---

## 8. Ce qu'on NE fait PAS

- **Pas de sélection par score brut (top N).** Le score ne sait pas
  distinguer une release qui compte d'un patch de routine — c'est tout le
  problème. La sélection est un jugement, pas un seuil numérique.
- **Pas de pénalité regex sur les versions** (`alpha`, `patch`, `vX.Y.Z`)
  dans le scoring pour l'instant. Trop fragile (tuerait Ollama 0.24). →
  `FUTURE.md`. La sélection éditoriale rend ce hack inutile au MVP.
- **Pas de modification de `publish.ts`.** Validation humaine inchangée.

---

## 9. Synchronisation des autres docs

Une fois validé sur un dry-run :

- **PLAN_3.md §6** : insérer l'étape « Sélection éditoriale » entre Étape 3
  (enrich) et Étape 4 (writer), renuméroter.
- **CONVENTIONS.md §Pipeline** : ajouter une règle « la sélection
  éditoriale propose, l'humain valide via publish ; plafond 6-8, jamais de
  quota plancher ».

Ne figer qu'**après** avoir vu une édition propre — même principe que pour
tous les correctifs depuis le début : on ne grave que ce qu'on a vérifié.

---

## Récap

- Nouvelle étape entre enrich et writer : un appel Sonnet qui garde ≤8
  items passant « est-ce que ça change ce que je vais builder cette
  semaine ? ».
- Plafond 6-8, **pas de plancher** (moins si moins de signal réel).
- Économise le writer (on n'écrit que le panier filtré) et le temps de run.
- `publish.ts` inchangé : la sélection propose, l'humain dispose.
- Le log des raisons garde/jette construit le critère éditorial au fil des
  éditions.
