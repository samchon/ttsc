package evidence

import (
  "testing"
)

/**
 * Verifies the matched name is the public one: an export alias moves the name
 * the file must carry.
 *
 * The alias is what a consumer imports, so the addressable name is the one the
 * bijection is about. Matching the local name instead would let a file be named
 * after something no consumer can reach.
 *
 *  1. Declare a local const and export it under another name.
 *  2. Run the rule against a file named after the alias.
 *  3. Assert silence.
 *
 * @evidence contracts/testing.md#behavioral-verification runSingularRule exercises the authored fixture. Assert silence.
 * @evidence contracts/testing.md#independent-expectations The alias is what a consumer imports, so the addressable name is the one the bijection is about. Matching the local name instead would let a file be named after something no consumer can reach. The authored scenario requires this outcome: Assert silence.
 * @evidence contracts/testing.md#distinguishing-cases Declare a local const and export it under another name. Run the rule against a file named after the alias. Assert silence.
 * @evidence contracts/testing.md#execution-ownership TestSingularMatchesExportAliasRatherThanLocalName runs as a Go unit entry in the native package. runSingularRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestSingularMatchesExportAliasRatherThanLocalName(t *testing.T) {
  assertSilent(t, runSingularRule(t, "src/Other.ts", `
const local = 1;
export { local as Other };
`))
}
