package evidence

import (
  "testing"
)

/**
 * Verifies the fallback name: an identity exposed only as a default takes its
 * declared name.
 *
 * `default` names no identity, so a file whose only exposure is a default
 * export has nothing addressable to match. Falling back to the declared name is
 * what makes `export default x` in `x.ts` legal.
 *
 *  1. Declare a local const and default-export it without exporting the name.
 *  2. Run the rule against a file named after the declaration.
 *  3. Assert silence.
 * @evidence contracts/testing.md#behavioral-verification runSingularRule exercises the authored fixture. Assert silence.
 * @evidence contracts/testing.md#independent-expectations `default` names no identity, so a file whose only exposure is a default export has nothing addressable to match. Falling back to the declared name is what makes `export default x` in `x.ts` legal. The authored scenario requires this outcome: Assert silence.
 * @evidence contracts/testing.md#distinguishing-cases Declare a local const and default-export it without exporting the name. Run the rule against a file named after the declaration. Assert silence.
 * @evidence contracts/testing.md#execution-ownership TestSingularFallsBackToDeclaredNameForDefaultOnlyExposure runs as a Go unit entry in the native package. runSingularRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestSingularFallsBackToDeclaredNameForDefaultOnlyExposure(t *testing.T) {
  assertSilent(t, runSingularRule(t, "src/handler.ts", `
const handler = (): void => {};
export default handler;
`))
}
