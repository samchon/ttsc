package evidence

import (
  "testing"
)

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
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert the inactive claim neither loads nor diagnoses that reference.
 * @evidence contracts/testing.md#independent-expectations Evaluation-only suppression is too late: an unreadable reference would still fail a graph whose claim has no declaration capable of acknowledging it. An enum is exported here but is not a `type` unit, which pins activation to the claim selector rather than to any export or merely matched file. The authored scenario requires this outcome: Assert the inactive claim neither loads nor diagnoses that reference.
 * @evidence contracts/testing.md#distinguishing-cases Match one healthy TypeScript file that exports no selected `type` unit. Point its Markdown reference at a missing root. Assert the inactive claim neither loads nor diagnoses that reference.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptClaimWithoutASelectedExportSkipsItsReferences runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
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
