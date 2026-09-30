package evidence

import (
  "testing"
)

/**
 * Verifies the index exemption does not extend to counting.
 *
 * The name match is what an index file cannot satisfy; the one-identity limit
 * is unrelated, and exempting it would turn every barrel into a legal dumping
 * ground.
 *
 *  1. Declare two identities in an index file.
 *  2. Run the rule.
 *  3. Assert the count is still enforced.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runSingularRule exercises the authored fixture. Assert the count is still enforced.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The name match is what an index file cannot satisfy; the one-identity limit is unrelated, and exempting it would turn every barrel into a legal dumping ground. The authored scenario requires this outcome: Assert the count is still enforced.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Declare two identities in an index file. Run the rule. Assert the count is still enforced.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestSingularStillCountsIdentitiesInIndexFiles runs as a Go unit entry in the native package. runSingularRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestSingularStillCountsIdentitiesInIndexFiles(t *testing.T) {
  messages := runSingularRule(t, "src/index.ts", `
export const alpha = 1;
export const beta = 2;
`)
  assertReported(t, messages, "declares exactly one public identity")
}
