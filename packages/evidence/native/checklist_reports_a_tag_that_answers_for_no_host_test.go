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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a tag that speaks for no selected host and discharges nothing is reported. The original assertions check assert the hosts still owe every item, so nothing was discharged by it.
 * @evidence contracts/testing.md#independent-expectations Under a checklist every acknowledgement is one host's answer, so a tag on a declaration the claim's `symbol` does not select answers nothing there. Spreading it across the claim instead was tried and withdrawn: that reach requires reading "no selected host" as "no host owes this", and two ordinary Markdown shapes satisfy it by accident, so one tag discharged every item for every host and reported nothing. The report is deferred rather than eager, so this case pins the arm where no sibling obligation consumes the tag and the report must still fire. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Select functions as hosts and put an exclusion on an exported interface, with no other obligation to consume it. Assert the tag is reported with the obligation that recorded it and its target. Assert the hosts still owe every item, so nothing was discharged by it. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestChecklistReportsATagThatAnswersForNoHost is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
