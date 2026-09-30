package evidence

import (
  "testing"
)

/**
 * Verifies the index exemption is keyed on the base name, not the extension.
 *
 * A project's entry point is `index.ts`, `index.tsx`, `index.mts`, or
 * `index.cts` depending on its module setup, and an exemption that matched only
 * one of them would report the others for a name no identifier can have.
 *
 *  1. Declare one differently named identity in each index extension.
 *  2. Run the rule.
 *  3. Assert every extension is exempt from the name match.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runSingularRule exercises the authored fixture. Assert every extension is exempt from the name match.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A project's entry point is `index.ts`, `index.tsx`, `index.mts`, or `index.cts` depending on its module setup, and an exemption that matched only one of them would report the others for a name no identifier can have. The authored scenario requires this outcome: Assert every extension is exempt from the name match.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Declare one differently named identity in each index extension. Run the rule. Assert every extension is exempt from the name match.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestSingularExemptsEveryIndexExtension runs as a Go unit entry in the native package. runSingularRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestSingularExemptsEveryIndexExtension(t *testing.T) {
  source := `
export const evidence = { name: "evidence" };
`
  for _, path := range []string{
    "src/index.ts",
    "src/index.tsx",
    "src/index.mts",
    "src/index.cts",
  } {
    assertSilent(t, runSingularRule(t, path, source))
  }
}
