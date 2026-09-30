package evidence

import (
  "testing"
)

/**
 * Verifies the name match covers the module extensions the graph already reads.
 *
 * `.mts` and `.cts` are ordinary source files to this rule, and a comparison
 * that stripped only `.ts` would leave `handler.mts` comparing as
 * `handler.mts`, reporting a correctly named file.
 *
 *  1. Declare one identity in an `.mts` and a `.cts` file of the same name.
 *  2. Run the rule.
 *  3. Assert both are silent.
 * @evidence contracts/testing.md#behavioral-verification runSingularRule exercises the authored fixture. Assert both are silent.
 * @evidence contracts/testing.md#independent-expectations `.mts` and `.cts` are ordinary source files to this rule, and a comparison that stripped only `.ts` would leave `handler.mts` comparing as `handler.mts`, reporting a correctly named file. The authored scenario requires this outcome: Assert both are silent.
 * @evidence contracts/testing.md#distinguishing-cases Declare one identity in an `.mts` and a `.cts` file of the same name. Run the rule. Assert both are silent.
 * @evidence contracts/testing.md#execution-ownership TestSingularStripsModuleExtensionsBeforeMatching runs as a Go unit entry in the native package. runSingularRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestSingularStripsModuleExtensionsBeforeMatching(t *testing.T) {
  source := `
export const handler = (): void => {};
`
  assertSilent(t, runSingularRule(t, "src/handler.mts", source))
  assertSilent(t, runSingularRule(t, "src/handler.cts", source))
}
