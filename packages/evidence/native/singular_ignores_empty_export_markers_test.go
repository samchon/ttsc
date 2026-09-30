package evidence

import (
  "testing"
)

/**
 * Verifies an empty module marker is not an identity.
 *
 * `export {}` exists to make a file a module and declares nothing. Treating an
 * export list as ownership regardless of its contents would report it.
 *
 *  1. Write only an empty export list.
 *  2. Run the rule.
 *  3. Assert silence.
 * @evidence contracts/testing.md#behavioral-verification runSingularRule exercises the authored fixture. Assert silence.
 * @evidence contracts/testing.md#independent-expectations `export {}` exists to make a file a module and declares nothing. Treating an export list as ownership regardless of its contents would report it. The authored scenario requires this outcome: Assert silence.
 * @evidence contracts/testing.md#distinguishing-cases Write only an empty export list. Run the rule. Assert silence.
 * @evidence contracts/testing.md#execution-ownership TestSingularIgnoresEmptyExportMarkers runs as a Go unit entry in the native package. runSingularRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestSingularIgnoresEmptyExportMarkers(t *testing.T) {
  assertSilent(t, runSingularRule(t, "src/ambient.ts", `
export {};
`))
}
