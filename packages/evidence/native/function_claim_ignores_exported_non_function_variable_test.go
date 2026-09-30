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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert the healthy zero-function claim remains inactive and silent.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Matching a TypeScript file or any exported declaration is insufficient. The own population must contain the symbol kind selected by the claim, so a scalar `const` cannot activate a function obligation. The authored scenario requires this outcome: Assert the healthy zero-function claim remains inactive and silent.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Export one scalar variable from a matched TypeScript file. Select only function hosts and configure an unreadable reference root. Assert the healthy zero-function claim remains inactive and silent.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestFunctionClaimIgnoresExportedNonFunctionVariable runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
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
