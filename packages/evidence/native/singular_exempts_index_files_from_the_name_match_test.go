package evidence

import (
  "testing"
)

/**
 * Verifies the index exemption is limited to the name: an index file may own
 * one identity of any name.
 *
 * The plugin's own entry point is exactly this shape, one declared identity
 * beside re-export barrels, and no identifier can be named `index`.
 *
 *  1. Declare one identity and re-export two barrels from an index file.
 *  2. Run the rule.
 *  3. Assert silence.
 * @evidence contracts/testing.md#behavioral-verification runSingularRule exercises the authored fixture. Assert silence.
 * @evidence contracts/testing.md#independent-expectations The plugin's own entry point is exactly this shape, one declared identity beside re-export barrels, and no identifier can be named `index`. The authored scenario requires this outcome: Assert silence.
 * @evidence contracts/testing.md#distinguishing-cases Declare one identity and re-export two barrels from an index file. Run the rule. Assert silence.
 * @evidence contracts/testing.md#execution-ownership TestSingularExemptsIndexFilesFromTheNameMatch runs as a Go unit entry in the native package. runSingularRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestSingularExemptsIndexFilesFromTheNameMatch(t *testing.T) {
  assertSilent(t, runSingularRule(t, "src/index.ts", `
export * from "./structures/index";
export const evidence = { name: "evidence" };
export default evidence;
`))
}
