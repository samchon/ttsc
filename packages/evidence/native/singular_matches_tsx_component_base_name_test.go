package evidence

import (
  "testing"
)

/**
 * Verifies extension handling: a `.tsx` component matches its base name.
 *
 * The comparison strips one extension, so a component file must match without
 * the reader having to spell the extension into the identity.
 *
 *  1. Export one component from a `.tsx` file of the same name.
 *  2. Run the rule.
 *  3. Assert silence.
 *
 * @evidence contracts/testing.md#behavioral-verification runSingularRule exercises the authored fixture. Assert silence.
 * @evidence contracts/testing.md#independent-expectations The comparison strips one extension, so a component file must match without the reader having to spell the extension into the identity. The authored scenario requires this outcome: Assert silence.
 * @evidence contracts/testing.md#distinguishing-cases Export one component from a `.tsx` file of the same name. Run the rule. Assert silence.
 * @evidence contracts/testing.md#execution-ownership TestSingularMatchesTsxComponentBaseName runs as a Go unit entry in the native package. runSingularRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestSingularMatchesTsxComponentBaseName(t *testing.T) {
  assertSilent(t, runSingularRule(t, "src/Button.tsx", `
export const Button = (): null => null;
`))
}
