package evidence

import "testing"

/**
 * Verifies a tag that speaks for no selected host and discharges nothing is reported.
 *
 * Under a checklist every acknowledgement is one host's answer, so a tag on a declaration the claim's `symbol` does not select answers nothing there. Spreading it across the claim instead was tried and withdrawn: that reach requires reading "no selected host" as "no host owes this", and two ordinary Markdown shapes satisfy it by accident, so one tag discharged every item for every host and reported nothing. The report is deferred rather than eager, so this case pins the arm where no sibling obligation consumes the tag and the report must still fire.
 *
 *  1. Select functions as hosts and put an exclusion on an exported interface, with no other obligation to consume it.
 *  2. Assert the tag is reported with the obligation that recorded it and its target.
 *  3. Assert the hosts still owe every item, so nothing was discharged by it.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a function checklist over an interface carrying `@evidenceExclude ...#no-whack-a-mole` and a cited function `first`; the test requires `Unhosted @evidenceExclude at src/ledger.ts:1 for Claim 1 reference 1 (markdown, symbols: h2), target 'docs/rules.md#no-whack-a-mole'`, `sits on no selected host and discharges no other obligation`, the move-the-tag repair for kind (function), and `first` still owing `1 of 2` items.
 * @evidence contracts/testing.md#independent-expectations The expected sentences are authored from the checklist contract that a tag on a declaration the claim does not select answers for no host: it must be reported with its obligation and target, and must not discharge the item for the real host.
 * @evidence contracts/testing.md#distinguishing-cases With no sibling obligation consuming the tag the report must fire; the consumed-by-sibling and consumed-by-overlap cases that suppress it are owned by sibling entries. The still-owed item on `first` shows the tag was not spread across hosts.
 * @evidence contracts/testing.md#execution-ownership TestChecklistReportsATagThatAnswersForNoHost is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestChecklistReportsATagThatAnswersForNoHost(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/rules.md": checklistDocument,
    "src/ledger.ts": `/** @evidenceExclude docs/rules.md#no-whack-a-mole This package has one code path. */
export interface ILedger {
  id: string;
}

/** @evidence docs/rules.md#no-hardcoding The general logic decides. */
export function first(): void {}
`,
  }, checklistConfig)
  assertProblemContains(t, messages, "Unhosted @evidenceExclude at src/ledger.ts:1 for Claim 1 reference 1 (markdown, symbols: h2), target 'docs/rules.md#no-whack-a-mole'")
  assertProblemContains(t, messages, "sits on no selected host and discharges no other obligation")
  assertProblemContains(t, messages, "Move the tag onto a host of a selected kind (function) in a claim that owes it")
  assertProblemContains(t, messages, "TypeScript function 'first'")
  assertProblemContains(t, messages, "has not acknowledged 1 of 2 checklist item(s): 'docs/rules.md#no-whack-a-mole'")
}
