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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a function claim over src/**\/*.ts and a Markdown reference over docs/**\/*.md, with `export const run = (): void => {};` and an uncited `## Contract` heading; assertProblemContains requires `Missing acknowledgement for 'docs/spec.md#contract'`.
 * @evidence contracts/testing.md#independent-expectations The expected obligation is authored: a callable variable is a function unit, so a function claim selecting it must owe the heading, in contrast to the exported-data variable that the sibling entry shows is outside the function population.
 * @evidence contracts/testing.md#distinguishing-cases Only the initializer differs from the sibling non-function variable case (arrow function instead of a literal); the diagnostic's presence, not its exclusivity, is asserted.
 * @evidence contracts/testing.md#execution-ownership TestCallableVariableActivatesFunctionClaim is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory, parses them and calls the graph rule directly, with no consumer install or product host.
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
