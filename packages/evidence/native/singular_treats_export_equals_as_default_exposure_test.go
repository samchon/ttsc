package evidence

import (
  "testing"
)

/**
 * Verifies `export =` is the same exposure as a default export.
 *
 * TypeScript's export assignment reaches the rule through the same node kind as
 * `export default`, distinguished only by a flag the rule deliberately ignores.
 * Both expose one declaration under no addressable name, so both fall back to
 * the declared name.
 *
 *  1. Declare a local const and expose it with `export =`.
 *  2. Run the rule against a file named after the declaration, then against one
 *     that is not.
 *  3. Assert the declared name is what the file must carry.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runSingularRule exercises the authored fixture. Assert the declared name is what the file must carry.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations TypeScript's export assignment reaches the rule through the same node kind as `export default`, distinguished only by a flag the rule deliberately ignores. Both expose one declaration under no addressable name, so both fall back to the declared name. The authored scenario requires this outcome: Assert the declared name is what the file must carry.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Declare a local const and expose it with `export =`. Run the rule against a file named after the declaration, then against one that is not. Assert the declared name is what the file must carry.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestSingularTreatsExportEqualsAsDefaultExposure runs as a Go unit entry in the native package. runSingularRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestSingularTreatsExportEqualsAsDefaultExposure(t *testing.T) {
  source := `
const bridge = { version: "1" };
export = bridge;
`
  assertSilent(t, runSingularRule(t, "src/bridge.ts", source))
  assertReported(
    t,
    runSingularRule(t, "src/entry.ts", source),
    "'entry.ts' declares 'bridge'",
  )
}
