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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a property claim and a two-item Markdown checklist over `export var price: number = 1, live: number = 2;` under one documentation block; with both items cited the graph must be silent, and with only `no-hardcoding` cited exactly two `checklist item(s)` diagnostics must appear, naming `'price'` and `'live'` and `has not acknowledged 1 of 2 checklist item(s): 'docs/rules.md#no-whack-a-mole'`.
 * @evidence contracts/testing.md#independent-expectations The expected counts are authored from the checklist contract that one block on a statement is the answer for every identity it declares, so both declarators are credited together and both owe a dropped item; the item text and documentation are literal fixtures.
 * @evidence contracts/testing.md#distinguishing-cases A complete answer (silence) against a partial one (two reports, one per identity) over the same statement: a ledger keyed so that one identity absorbs the credit would report only one of the two names, and the exact count of two excludes that.
 * @evidence contracts/testing.md#execution-ownership TestChecklistCreditsEveryIdentityOfOneDeclaration is a Go unit entry in the native test process; it calls the graph rule twice through runIndexRule over temp fixture files, with no consumer install or product host.
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
