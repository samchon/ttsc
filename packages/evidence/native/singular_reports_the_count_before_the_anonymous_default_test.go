package evidence

import (
  "testing"
)

/**
 * Verifies the count diagnostic wins over the anonymous-default one.
 *
 * A file with both problems gets one finding, and it must be the structural
 * one: the extra identity has to move before the file's name can mean anything,
 * and stacking two findings on one file teaches readers to skim them.
 *
 *  1. Declare two identities beside an anonymous default.
 *  2. Run the rule.
 *  3. Assert exactly one finding, naming the count.
 * @evidence contracts/testing.md#behavioral-verification runSingularRule exercises the authored fixture. Assert exactly one finding, naming the count.
 * @evidence contracts/testing.md#independent-expectations A file with both problems gets one finding, and it must be the structural one: the extra identity has to move before the file's name can mean anything, and stacking two findings on one file teaches readers to skim them. The authored scenario requires this outcome: Assert exactly one finding, naming the count.
 * @evidence contracts/testing.md#distinguishing-cases Declare two identities beside an anonymous default. Run the rule. Assert exactly one finding, naming the count.
 * @evidence contracts/testing.md#execution-ownership TestSingularReportsTheCountBeforeTheAnonymousDefault runs as a Go unit entry in the native package. runSingularRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestSingularReportsTheCountBeforeTheAnonymousDefault(t *testing.T) {
  assertReported(t, runSingularRule(t, "src/pair.ts", `
export const alpha = 1;
export const beta = 2;
export default (): void => {};
`), "declares exactly one public identity")
}
