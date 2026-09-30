package evidence

import (
  "testing"
)

/**
 * Verifies an exported callable variable activates a function claim.
 *
 * The negative twin in TestFunctionClaimIgnoresExportedNonFunctionVariable proves ordinary exported data stays outside the
 * function population. Replacing only its initializer with an arrow function
 * must open the existing obligation without a configuration change.
 *
 *  1. Export one arrow-function variable from a matched TypeScript file.
 *  2. Materialize one unacknowledged Markdown heading.
 *  3. Assert the selected callable activates missing-acknowledgement coverage.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert the selected callable activates missing-acknowledgement coverage.
 * @evidence contracts/testing.md#independent-expectations The negative twin in TestFunctionClaimIgnoresExportedNonFunctionVariable proves ordinary exported data stays outside the function population. Replacing only its initializer with an arrow function must open the existing obligation without a configuration change. The authored scenario requires this outcome: Assert the selected callable activates missing-acknowledgement coverage.
 * @evidence contracts/testing.md#distinguishing-cases Export one arrow-function variable from a matched TypeScript file. Materialize one unacknowledged Markdown heading. Assert the selected callable activates missing-acknowledgement coverage.
 * @evidence contracts/testing.md#execution-ownership TestCallableVariableActivatesFunctionClaim runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestCallableVariableActivatesFunctionClaim(t *testing.T) {
  assertProblemContains(t, runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract\n",
    "src/run.ts":   "export const run = (): void => {};\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/**/*.md"],
      "symbol":"h2"
    }
  }]}`), "Missing acknowledgement for 'docs/spec.md#contract'")
}
