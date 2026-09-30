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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies an unhosted checklist tag consumed by an overlapping claim is not reported. The original assertions check assert the whole graph passes.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Two claims over one file set may select different host kinds against one document, so a declaration can be another claim's own selected host while the checklist claim's `symbol` ignores it. The tag is that claim's answer, and the checklist claim refusing it rejected a tag already owned elsewhere, which the evaluator's overlap rule forbids for every other finding of this kind. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Declare a checklist claim over functions and an ordinary claim over types, both selecting the same files and document. Exclude the document from the interface the ordinary claim selects, and answer every checklist item from the function. Assert the whole graph passes. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestChecklistLeavesAnUnhostedTagAnOverlappingClaimConsumes is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
