package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies an unhosted checklist tag consumed by a sibling reference is not reported.
 *
 * Carrier eligibility is wider than the checklist's host gate, so one claim can hold an ordinary reference whose gathered carrier exclusion is legitimate and a checklist reference for which the same tag answers nothing. An eager report made that valid configuration inexpressible: no placement satisfied both references at once.
 *
 *  1. Declare an ordinary and a checklist reference over one document in one claim.
 *  2. Exclude one item from an exported interface the claim's `symbol` does not select, and cite the other item from a function.
 *  3. Assert the ordinary reference is silent, the checklist host owes only its unanswered item, and no unhosted report fires.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies an unhosted checklist tag consumed by a sibling reference is not reported. The original assertions check assert the ordinary reference is silent, the checklist host owes only its unanswered item, and no unhosted report fires.
 * @evidence contracts/testing.md#independent-expectations Carrier eligibility is wider than the checklist's host gate, so one claim can hold an ordinary reference whose gathered carrier exclusion is legitimate and a checklist reference for which the same tag answers nothing. An eager report made that valid configuration inexpressible: no placement satisfied both references at once. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Declare an ordinary and a checklist reference over one document in one claim. Exclude one item from an exported interface the claim's `symbol` does not select, and cite the other item from a function. Assert the ordinary reference is silent, the checklist host owes only its unanswered item, and no unhosted report fires. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestChecklistLeavesAnUnhostedTagASiblingReferenceConsumes is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestChecklistLeavesAnUnhostedTagASiblingReferenceConsumes(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/rules.md": checklistDocument,
    "src/ledger.ts": `/** @evidenceExclude docs/rules.md#no-whack-a-mole This package has one code path. */
export interface ILedger {
  id: string;
}
`,
    "src/first.ts": `/** @evidence docs/rules.md#no-hardcoding The general logic decides. */
export function first(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":[
      {
        "type":"markdown",
        "files":["docs/rules.md"],
        "symbol":"h2"
      },
      {
        "type":"markdown",
        "files":["docs/rules.md"],
        "symbol":"h2",
        "checklist":true
      }
    ]
  }]}`)
  if strings.Contains(strings.Join(messages, "\n"), "Unhosted") {
    t.Fatalf("a tag the ordinary reference consumed was reported as unhosted:\n%s", strings.Join(messages, "\n"))
  }
  if strings.Contains(strings.Join(messages, "\n"), "Missing acknowledgement") {
    t.Fatalf("the ordinary reference lost the carrier exclusion:\n%s", strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "TypeScript function 'first'")
  assertProblemContains(t, messages, "has not acknowledged 1 of 2 checklist item(s): 'docs/rules.md#no-whack-a-mole'")
  // Exactly the checklist shortfall. The count is what pins suppression to the
  // report about the tag alone: an implementation that also credited the host
  // with the excluded item would drop this to zero, and one that still refused
  // the tag would raise it to two.
  if len(messages) != 1 {
    t.Fatalf("expected the checklist shortfall alone, got:\n%s", strings.Join(messages, "\n"))
  }
}
