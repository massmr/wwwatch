/**
 * lib/prompt.ts - Selection prompt for the editorial selection step.
 *
 * Contains only buildSelectionPrompt. Writer and intro prompts live in
 * lib/writer.ts where they were authored (not centralised here; that is
 * out of scope; see FUTURE.md if needed).
 */
import type { SelectionCandidate } from './selector';

export function buildSelectionPrompt(candidates: SelectionCandidate[]): string {
  const candidateList = candidates
    .map(
      (c) =>
        `ID: ${c.id}\nTitle: ${c.title}\nSource: ${c.source}\nSnippet: ${c.snippet}`,
    )
    .join('\n\n---\n\n');

  return `\
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

${candidateList}`;
}
