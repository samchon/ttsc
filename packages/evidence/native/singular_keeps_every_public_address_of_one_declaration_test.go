package evidence

import (
  "testing"
)

/**
 * Verifies a local exported under two names keeps both addresses.
 *
 * Exporting one declaration twice is legal, and collapsing the pair to a single
 * address would report a file legitimately named after the dropped one. That is
 * a false positive, which is the failure mode that gets a rule disabled.
 *
 *  1. Export one local const under two public names.
 *  2. Run the rule against a file named after each in turn.
 *  3. Assert both are silent.
 * @evidence contracts/testing.md#behavioral-verification runSingularRule exercises the authored fixture. Assert both are silent.
 * @evidence contracts/testing.md#independent-expectations Exporting one declaration twice is legal, and collapsing the pair to a single address would report a file legitimately named after the dropped one. That is a false positive, which is the failure mode that gets a rule disabled. The authored scenario requires this outcome: Assert both are silent.
 * @evidence contracts/testing.md#distinguishing-cases Export one local const under two public names. Run the rule against a file named after each in turn. Assert both are silent.
 * @evidence contracts/testing.md#execution-ownership TestSingularKeepsEveryPublicAddressOfOneDeclaration runs as a Go unit entry in the native package. runSingularRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestSingularKeepsEveryPublicAddressOfOneDeclaration(t *testing.T) {
  source := `
const value = 1;
export { value as Alpha, value as Beta };
`
  assertSilent(t, runSingularRule(t, "src/Alpha.ts", source))
  assertSilent(t, runSingularRule(t, "src/Beta.ts", source))
}
