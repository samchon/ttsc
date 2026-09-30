package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies one declaration hosting several identities answers for each of them.
 *
 * A mixed variable statement is one node that declares two selected hosts, and TypeScript attaches its documentation to the statement rather than to either declarator. Under a checklist that makes one tag block the answer for two hosts at once, so a per-host ledger keyed on the wrong side of that relation would credit one identity and leave its sibling owing everything.
 *
 *  1. Select properties and declare two of them in one statement under one block.
 *  2. Answer both items there and assert the claim passes.
 *  3. Drop one item and assert both identities report it.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies one declaration hosting several identities answers for each of them. The original assertions check drop one item and assert both identities report it.
 * @evidence contracts/testing.md#independent-expectations A mixed variable statement is one node that declares two selected hosts, and TypeScript attaches its documentation to the statement rather than to either declarator. Under a checklist that makes one tag block the answer for two hosts at once, so a per-host ledger keyed on the wrong side of that relation would credit one identity and leave its sibling owing everything. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Select properties and declare two of them in one statement under one block. Answer both items there and assert the claim passes. Drop one item and assert both identities report it. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestChecklistCreditsEveryIdentityOfOneDeclaration is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestChecklistCreditsEveryIdentityOfOneDeclaration(t *testing.T) {
  config := `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"property",
    "reference":{
      "type":"markdown",
      "files":["docs/rules.md"],
      "symbol":"h2",
      "checklist":true
    }
  }]}`
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "docs/rules.md": checklistDocument,
    "src/rates.ts": `/**
 * @evidence docs/rules.md#no-hardcoding Both rates come from configuration.
 * @evidence docs/rules.md#no-whack-a-mole Both rates cover every tier.
 */
export var price: number = 1, live: number = 2;
`,
  }, config))

  partial := runIndexRule(t, map[string]string{
    "docs/rules.md": checklistDocument,
    "src/rates.ts": `/** @evidence docs/rules.md#no-hardcoding Both rates come from configuration. */
export var price: number = 1, live: number = 2;
`,
  }, config)
  if count := countProblemsContaining(partial, "checklist item(s)"); count != 2 {
    t.Fatalf("expected both identities of the statement to owe the dropped item, got %d:\n%s", count, strings.Join(partial, "\n"))
  }
  assertProblemContains(t, partial, "'price'")
  assertProblemContains(t, partial, "'live'")
  assertProblemContains(t, partial, "has not acknowledged 1 of 2 checklist item(s): 'docs/rules.md#no-whack-a-mole'")
}
