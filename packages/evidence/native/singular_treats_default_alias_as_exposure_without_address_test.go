package evidence

import (
  "testing"
)

/**
 * Verifies `export { x as default }` is the same exposure as `export default x`.
 *
 * Both forms expose one declaration under no addressable name. Treating the
 * list form as no exposure at all would let the rule miss the file entirely,
 * and a rule that silently sees nothing is indistinguishable from one that
 * passed.
 *
 *  1. Expose a local declaration through an export list as `default`.
 *  2. Run the rule against a file named after neither the declaration nor
 *     `default`.
 *  3. Assert the declared name is demanded.
 *
 * @evidence contracts/testing.md#behavioral-verification runSingularRule exercises the authored fixture. Assert the declared name is demanded.
 * @evidence contracts/testing.md#independent-expectations Both forms expose one declaration under no addressable name. Treating the list form as no exposure at all would let the rule miss the file entirely, and a rule that silently sees nothing is indistinguishable from one that passed. The authored scenario requires this outcome: Assert the declared name is demanded.
 * @evidence contracts/testing.md#distinguishing-cases Expose a local declaration through an export list as `default`. Run the rule against a file named after neither the declaration nor `default`. Assert the declared name is demanded.
 * @evidence contracts/testing.md#execution-ownership TestSingularTreatsDefaultAliasAsExposureWithoutAddress runs as a Go unit entry in the native package. runSingularRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestSingularTreatsDefaultAliasAsExposureWithoutAddress(t *testing.T) {
  messages := runSingularRule(t, "src/entry.ts", `
const handler = (): void => {};
export { handler as default };
`)
  assertReported(t, messages, "'entry.ts' declares 'handler'")
}
