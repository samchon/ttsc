package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a checklist refuses an aggregate citation and keeps the exclusion cascade.
 *
 * The whole point of the option collapses if one file-level citation ticks every box, so a positive target naming a scope that merely contains the items is refused by name. The negative twin matters just as much: "none of this applies here" is one reviewed decision however many items it covers, so the same target must still discharge the host as an exclusion.
 *
 *  1. Cite the containing document from one host under an H2 checklist, beside a second host carrying no tag.
 *  2. Assert the aggregate target is reported, its items are not listed again on its own host, and the silent host still owes both.
 *  3. Exclude the same document from the citing host and assert it passes.
 * @evidence contracts/testing.md#behavioral-verification Under a function checklist, runIndexRule is run with `broad` citing the whole document and `silent` carrying no tag, and must produce exactly two messages: `Aggregate @evidence target 'docs/rules.md'` (naming the scope's two items and `Cite each item this host answers for`) and the `silent` host owing `2 of 2` items; with `broad` instead carrying `@evidenceExclude docs/rules.md` the only message must be the silent host's shortfall.
 * @evidence contracts/testing.md#independent-expectations The expected wording and counts are authored from the checklist contract: an aggregate positive citation is refused by name, while an aggregate exclusion is one reviewed decision that discharges its own host; the citing host contributes no checklist shortfall in either arm.
 * @evidence contracts/testing.md#distinguishing-cases The silent host is the control that separates per-host suppression from claim-wide suppression, and the exact message counts (two, then one) pin that the citing host adds no extra diagnostic; the aggregate citation and the aggregate exclusion are the two arms that must differ.
 * @evidence contracts/testing.md#execution-ownership TestChecklistRefusesAnAggregateCitationButNotAnAggregateExclusion is a Go unit entry in the native test process; it calls the graph rule twice through runIndexRule over temp fixture files, with no consumer install or product host.
 */
func TestChecklistRefusesAnAggregateCitationButNotAnAggregateExclusion(t *testing.T) {
  // The silent host is what separates per-host suppression from claim-wide
  // suppression. With only the citing host present, a regression that let one
  // host's refused aggregate silence every other host's shortfall passed the
  // whole suite.
  aggregate := runIndexRule(t, map[string]string{
    "docs/rules.md": checklistDocument,
    "src/broad.ts": `/** @evidence docs/rules.md Everything in here is honored. */
export function broad(): void {}
`,
    "src/silent.ts": "export function silent(): void {}\n",
  }, checklistConfig)
  assertProblemContains(t, aggregate, "Aggregate @evidence target 'docs/rules.md'")
  assertProblemContains(t, aggregate, "names a scope containing 2 item(s) ('docs/rules.md#no-hardcoding', 'docs/rules.md#no-whack-a-mole') rather than one of them")
  assertProblemContains(t, aggregate, "Cite each item this host answers for")
  if count := countProblemsContaining(aggregate, "checklist item(s)"); count != 1 {
    t.Fatalf("expected the silent host alone to owe items, got %d:\n%s", count, strings.Join(aggregate, "\n"))
  }
  assertProblemContains(t, aggregate, "TypeScript function 'silent'")
  assertProblemContains(t, aggregate, "has not acknowledged 2 of 2 checklist item(s): 'docs/rules.md#no-hardcoding', 'docs/rules.md#no-whack-a-mole'")
  // Exactly the refusal and the silent host's shortfall. Counting the messages
  // is what pins the citing host to one diagnostic, and no guard matching its
  // name can: the aggregate message carries the source path rather than the
  // host's readable name, so such a condition is false today, and a guard that
  // fires only when the name appears more than once would still miss every
  // regression that makes it appear exactly once.
  if len(aggregate) != 2 {
    t.Fatalf("expected the aggregate refusal and one shortfall and nothing else, got:\n%s", strings.Join(aggregate, "\n"))
  }

  // The exclusion twin needs the silent host for the same reason the positive
  // arm does. With one host, an aggregate exclusion that spread across the claim
  // instead of discharging its own host would be indistinguishable from one that
  // did not.
  excluded := runIndexRule(t, map[string]string{
    "docs/rules.md": checklistDocument,
    "src/broad.ts": `/** @evidenceExclude docs/rules.md This module is generated. */
export function broad(): void {}
`,
    "src/silent.ts": "export function silent(): void {}\n",
  }, checklistConfig)
  if len(excluded) != 1 {
    t.Fatalf("expected the silent host's shortfall alone, got:\n%s", strings.Join(excluded, "\n"))
  }
  assertProblemContains(t, excluded, "TypeScript function 'silent'")
  assertProblemContains(t, excluded, "has not acknowledged 2 of 2 checklist item(s): 'docs/rules.md#no-hardcoding', 'docs/rules.md#no-whack-a-mole'")
}
