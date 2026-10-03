package evidence

import (
  "testing"
)

/**
 * Verifies the name match: a file named after its single identity is silent.
 *
 * The positive anchor for every mismatch complementary case. Without it a rule that
 * fired unconditionally would still satisfy them.
 *
 *  1. Export one interface.
 *  2. Run the rule against a file of the same name.
 *  3. Assert silence.
 *
 * @evidence contracts/testing.md#behavioral-verification runSingularRule exercises the authored fixture. Assert silence.
 * @evidence contracts/testing.md#independent-expectations The positive anchor for every mismatch complementary case. Without it a rule that fired unconditionally would still satisfy them. The authored scenario requires this outcome: Assert silence.
 * @evidence contracts/testing.md#distinguishing-cases Export one interface. Run the rule against a file of the same name. Assert silence.
 * @evidence contracts/testing.md#execution-ownership TestSingularAcceptsFileNamedAfterItsIdentity runs as a Go unit entry in the native package. runSingularRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestSingularAcceptsFileNamedAfterItsIdentity(t *testing.T) {
  assertSilent(t, runSingularRule(t, "src/IShoppingSale.ts", `
export interface IShoppingSale {
  id: string;
}
`))
}
