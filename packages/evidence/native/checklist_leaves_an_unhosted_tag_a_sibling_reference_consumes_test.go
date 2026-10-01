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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with one function claim carrying an ordinary and a checklist Markdown reference over one document, where an interface (unselected kind) carries `@evidenceExclude` for `no-whack-a-mole` and a function cites `no-hardcoding`; the test requires no `Unhosted` and no `Missing acknowledgement` diagnostic, a diagnostic for `TypeScript function 'first'` owing `1 of 2` (`no-whack-a-mole`), and exactly one message in total.
 * @evidence contracts/testing.md#independent-expectations The expected single shortfall is authored from the contract that a carrier exclusion consumed by the ordinary sibling reference is legitimate and must not be reported as unhosted by the checklist reference, while the checklist host still owes the item that exclusion does not answer for it.
 * @evidence contracts/testing.md#distinguishing-cases The exact message count separates three regressions: reporting the tag as unhosted (count two), losing the carrier exclusion for the ordinary reference (a missing-acknowledgement message), and crediting the checklist host with the excluded item (count zero).
 * @evidence contracts/testing.md#execution-ownership TestChecklistLeavesAnUnhostedTagASiblingReferenceConsumes is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
