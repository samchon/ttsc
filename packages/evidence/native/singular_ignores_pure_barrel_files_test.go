package evidence

import (
  "testing"
)

/**
 * Verifies barrel handling falls out of ownership: a file that only re-exports
 * owns nothing and is silent.
 *
 * This is deliberately not an exemption. Re-exports declare nothing here, so a
 * barrel already counts zero , writing a barrel exemption instead would also
 * excuse a barrel that declares three identities of its own.
 *
 *  1. Re-export a namespace, a star, and a named binding from other modules.
 *  2. Run the rule against a file named after none of them.
 *  3. Assert silence.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runSingularRule exercises the authored fixture. Assert silence.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations This is deliberately not an exemption. Re-exports declare nothing here, so a barrel already counts zero , writing a barrel exemption instead would also excuse a barrel that declares three identities of its own. The authored scenario requires this outcome: Assert silence.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Re-export a namespace, a star, and a named binding from other modules. Run the rule against a file named after none of them. Assert silence.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestSingularIgnoresPureBarrelFiles runs as a Go unit entry in the native package. runSingularRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestSingularIgnoresPureBarrelFiles(t *testing.T) {
  assertSilent(t, runSingularRule(t, "src/exports.ts", `
export * from "./alpha";
export * as beta from "./beta";
export { gamma } from "./gamma";
export type { IDelta } from "./delta";
`))
}
