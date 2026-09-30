package evidence

import "testing"

/**
 * Verifies an exported callable variable activates a function claim.
 *
 * The negative twin above proves ordinary exported data stays outside the
 * function population. Replacing only its initializer with an arrow function
 * must open the existing obligation without a configuration change.
 *
 *  1. Export one arrow-function variable from a matched TypeScript file.
 *  2. Materialize one unacknowledged Markdown heading.
 *  3. Assert the selected callable activates missing-acknowledgement coverage.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies an exported callable variable activates a function claim. The original assertions check assert the selected callable activates missing-acknowledgement coverage.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The negative twin above proves ordinary exported data stays outside the function population. Replacing only its initializer with an arrow function must open the existing obligation without a configuration change. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Export one arrow-function variable from a matched TypeScript file. Materialize one unacknowledged Markdown heading. Assert the selected callable activates missing-acknowledgement coverage. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestCallableVariableActivatesFunctionClaim is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
