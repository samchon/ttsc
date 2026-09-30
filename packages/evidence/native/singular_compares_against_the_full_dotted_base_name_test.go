package evidence

import (
  "testing"
)

/**
 * Verifies dotted infixes are not matched by prefix.
 *
 * Only the final extension is stripped, so `parse.helper.ts` compares against
 * `parse.helper`, which no identifier can equal. Stripping every extension
 * would silently accept two files claiming one identity name.
 *
 *  1. Export `parse` from `parse.helper.ts`.
 *  2. Run the rule.
 *  3. Assert the mismatch is reported against the full base name.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runSingularRule exercises the authored fixture. Assert the mismatch is reported against the full base name.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Only the final extension is stripped, so `parse.helper.ts` compares against `parse.helper`, which no identifier can equal. Stripping every extension would silently accept two files claiming one identity name. The authored scenario requires this outcome: Assert the mismatch is reported against the full base name.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Export `parse` from `parse.helper.ts`. Run the rule. Assert the mismatch is reported against the full base name.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestSingularComparesAgainstTheFullDottedBaseName runs as a Go unit entry in the native package. runSingularRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestSingularComparesAgainstTheFullDottedBaseName(t *testing.T) {
  messages := runSingularRule(t, "src/parse.helper.ts", `
export const parse = (): void => {};
`)
  assertReported(t, messages, "'parse.helper.ts' declares 'parse'")
}
