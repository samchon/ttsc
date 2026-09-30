package evidence

import (
  "testing"
)

/**
 * Verifies the counting rule fires: two unrelated identities in one file are
 * reported once, naming both.
 *
 * The merged-declaration complementary cases prove the rule stays quiet; without this
 * twin they would equally be satisfied by a rule that never fires at all.
 *
 *  1. Export two unrelated constants.
 *  2. Run the rule.
 *  3. Assert one diagnostic naming both identities.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runSingularRule exercises the authored fixture. Assert one diagnostic naming both identities.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The merged-declaration complementary cases prove the rule stays quiet; without this twin they would equally be satisfied by a rule that never fires at all. The authored scenario requires this outcome: Assert one diagnostic naming both identities.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Export two unrelated constants. Run the rule. Assert one diagnostic naming both identities.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestSingularReportsTwoUnrelatedIdentities runs as a Go unit entry in the native package. runSingularRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestSingularReportsTwoUnrelatedIdentities(t *testing.T) {
  messages := runSingularRule(t, "src/alpha.ts", `
export const alpha = 1;
export const beta = 2;
`)
  assertReported(t, messages, "declares exactly one public identity")
  assertReported(t, messages, "'alpha' (line 2)")
  assertReported(t, messages, "'beta' (line 3)")
}
