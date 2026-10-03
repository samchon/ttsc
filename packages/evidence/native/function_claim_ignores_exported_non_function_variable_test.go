package evidence

import (
  "testing"
)

/**
 * Verifies a function claim ignores an exported non-function variable.
 *
 * Matching a TypeScript file or any exported declaration is insufficient.
 * The own population must contain the symbol kind selected by the claim, so a
 * scalar `const` cannot activate a function obligation.
 *
 *  1. Export one scalar variable from a matched TypeScript file.
 *  2. Select only function hosts and configure an unreadable reference root.
 *  3. Assert the healthy zero-function claim remains inactive and silent.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a function claim over src/**\/*.ts containing only `export const value = 1;` and a Markdown reference rooted at the nonexistent `missing-docs`; assertNoProblems requires an empty list.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the activation contract: the claim's own population must contain the selected kind, so a scalar const is not a function host, the claim stays inactive, and the unreadable reference root is never evaluated.
 * @evidence contracts/testing.md#distinguishing-cases The nonexistent reference root is the probe: if the scalar activated the function claim, the root failure would be reported. The callable-variable twin that does activate the claim is owned by TestCallableVariableActivatesFunctionClaim.
 * @evidence contracts/testing.md#execution-ownership TestFunctionClaimIgnoresExportedNonFunctionVariable is a Go unit entry in the native test process; runIndexRule writes the fixture to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestFunctionClaimIgnoresExportedNonFunctionVariable(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "src/value.ts": "export const value = 1;\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "root":"missing-docs",
      "files":["**/*.md"],
      "symbol":"h2"
    }
  }]}`))
}
