package evidence

import (
  "testing"
)

/**
 * Verifies a healthy claim glob matching zero files is inactive.
 *
 * A typo and an intentionally empty folder are indistinguishable from the
 * selected Program population alone. Both therefore have the same activation
 * semantics: without one matching selected export, no reference is loaded and
 * no acknowledgement diagnostic is emitted.
 *
 *  1. Miss every TypeScript source with a typo in the claim glob.
 *  2. Give the empty claim an unreadable Markdown reference root.
 *  3. Assert the whole claim remains inactive and silent.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert the whole claim remains inactive and silent.
 * @evidence contracts/testing.md#independent-expectations A typo and an intentionally empty folder are indistinguishable from the selected Program population alone. Both therefore have the same activation semantics: without one matching selected export, no reference is loaded and no acknowledgement diagnostic is emitted. The authored scenario requires this outcome: Assert the whole claim remains inactive and silent.
 * @evidence contracts/testing.md#distinguishing-cases Miss every TypeScript source with a typo in the claim glob. Give the empty claim an unreadable Markdown reference root. Assert the whole claim remains inactive and silent.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptClaimMatchingZeroFilesIsInactive runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptClaimMatchingZeroFilesIsInactive(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "src/contract.ts": "export interface Contract {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/typo/**"],
    "symbol":"type",
    "reference":{
      "type":"markdown",
      "root":"missing-docs",
      "files":["**/*.md"],
      "symbol":"h2"
    }
  }]}`))
}
