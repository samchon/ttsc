package evidence

import "testing"

/**
 * Verifies an unhosted checklist tag consumed by an overlapping claim is not reported.
 *
 * Two claims over one file set may select different host kinds against one document, so a declaration can be another claim's own selected host while the checklist claim's `symbol` ignores it. The tag is that claim's answer, and the checklist claim refusing it rejected a tag already owned elsewhere, which the evaluator's overlap rule forbids for every other finding of this kind.
 *
 *  1. Declare a checklist claim over functions and an ordinary claim over types, both selecting the same files and document.
 *  2. Exclude the document from the interface the ordinary claim selects, and answer every checklist item from the function.
 *  3. Assert the whole graph passes.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a function checklist claim and a type claim over the same files and document, where an interface carries `@evidenceExclude docs/rules.md` and a function cites both checklist items; assertNoProblems requires an empty diagnostic list.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the overlap contract: a tag on a declaration that another claim selects as its host is that claim's answer, so the checklist claim must not report it as unhosted; every checklist item is answered by the function, so nothing is owed.
 * @evidence contracts/testing.md#distinguishing-cases Two claims selecting different host kinds over the same file set; the unhosted report without any consuming claim is owned by a sibling entry, and silence here would fail if the checklist claim refused a tag another claim owns.
 * @evidence contracts/testing.md#execution-ownership TestChecklistLeavesAnUnhostedTagAnOverlappingClaimConsumes is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestChecklistLeavesAnUnhostedTagAnOverlappingClaimConsumes(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "docs/rules.md": checklistDocument,
    "src/ledger.ts": `/** @evidenceExclude docs/rules.md This module only stores records. */
export interface ILedger {
  id: string;
}
`,
    "src/first.ts": `/**
 * @evidence docs/rules.md#no-hardcoding The general logic decides.
 * @evidence docs/rules.md#no-whack-a-mole Every sibling case is covered.
 */
export function first(): void {}
`,
  }, `{"claims":[
    {
      "type":"typescript",
      "files":["src/**"],
      "symbol":"function",
      "reference":{
        "type":"markdown",
        "files":["docs/rules.md"],
        "symbol":"h2",
        "checklist":true
      }
    },
    {
      "type":"typescript",
      "files":["src/**"],
      "symbol":"type",
      "reference":{
        "type":"markdown",
        "files":["docs/rules.md"],
        "symbol":"h2"
      }
    }
  ]}`))
}
