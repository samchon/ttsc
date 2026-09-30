package evidence

import "testing"

/**
 * Verifies a healthy TypeScript claim with no selected exported host is
 * inactive before its references load.
 *
 * Evaluation-only suppression is too late: an unreadable reference would
 * still fail a graph whose claim has no declaration capable of acknowledging
 * it. An enum is exported here but is not a `type` unit, which pins activation
 * to the claim selector rather than to any export or merely matched file.
 *
 *  1. Match one healthy TypeScript file that exports no selected `type` unit.
 *  2. Point its Markdown reference at a missing root.
 *  3. Assert the inactive claim neither loads nor diagnoses that reference.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a healthy TypeScript claim with no selected exported host is inactive before its references load. The original assertions check assert the inactive claim neither loads nor diagnoses that reference.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Evaluation-only suppression is too late: an unreadable reference would still fail a graph whose claim has no declaration capable of acknowledging it. An enum is exported here but is not a `type` unit, which pins activation to the claim selector rather than to any export or merely matched file. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Match one healthy TypeScript file that exports no selected `type` unit. Point its Markdown reference at a missing root. Assert the inactive claim neither loads nor diagnoses that reference. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestTypeScriptClaimWithoutASelectedExportSkipsItsReferences is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestTypeScriptClaimWithoutASelectedExportSkipsItsReferences(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "src/placeholder.ts": "export enum Placeholder {\n  Empty = \"empty\",\n}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"type",
    "reference":{
      "type":"markdown",
      "root":"missing-docs",
      "files":["**/*.md"],
      "symbol":"h2"
    }
  }]}`))
}
