package evidence

import (
  "testing"
)

/**
 * Verifies the alias twin: the same file named after the local name fires.
 *
 * One property away from the accepted complementary case, and the property is exactly
 * the one the rule claims to enforce.
 *
 *  1. Declare a local const and export it under another name.
 *  2. Run the rule against a file named after the local binding.
 *  3. Assert the public name is demanded.
 * @evidence contracts/testing.md#behavioral-verification runSingularRule exercises the authored fixture. Assert the public name is demanded.
 * @evidence contracts/testing.md#independent-expectations One property away from the accepted complementary case, and the property is exactly the one the rule claims to enforce. The authored scenario requires this outcome: Assert the public name is demanded.
 * @evidence contracts/testing.md#distinguishing-cases Declare a local const and export it under another name. Run the rule against a file named after the local binding. Assert the public name is demanded.
 * @evidence contracts/testing.md#execution-ownership TestSingularReportsAliasedIdentityUnderItsLocalName runs as a Go unit entry in the native package. runSingularRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestSingularReportsAliasedIdentityUnderItsLocalName(t *testing.T) {
  messages := runSingularRule(t, "src/local.ts", `
const local = 1;
export { local as Other };
`)
  assertReported(t, messages, "'local.ts' declares 'Other'")
}
