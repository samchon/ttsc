package evidence

import (
  "testing"
)

/**
 * Verifies identity counting through a default alias: a default export of a
 * local declaration adds no second identity.
 *
 * `export default something` exposes the name `default`, which names no
 * identity. Counting public names rather than identities would report this
 * file, and the plugin's own entry point uses exactly this shape.
 *
 *  1. Export a const and default-export the same binding.
 *  2. Run the rule against a file named after the const.
 *  3. Assert silence.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runSingularRule exercises the authored fixture. Assert silence.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations `export default something` exposes the name `default`, which names no identity. Counting public names rather than identities would report this file, and the plugin's own entry point uses exactly this shape. The authored scenario requires this outcome: Assert silence.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Export a const and default-export the same binding. Run the rule against a file named after the const. Assert silence.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestSingularCountsDefaultAliasOfLocalDeclarationOnce runs as a Go unit entry in the native package. runSingularRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestSingularCountsDefaultAliasOfLocalDeclarationOnce(t *testing.T) {
  assertSilent(t, runSingularRule(t, "src/evidence.ts", `
export const evidence = { name: "evidence" };
export default evidence;
`))
}
