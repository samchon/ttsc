package evidence

import (
  "testing"
)

/**
 * Verifies anonymous default classes reach the anonymous branch.
 *
 * An unnamed class declaration carries the same export and default modifiers as
 * an unnamed function but arrives under a different node kind, so the branch
 * that names neither has to be reached from both.
 *
 *  1. Default-export an unnamed class.
 *  2. Run the rule.
 *  3. Assert the anonymous-default message.
 * @evidence contracts/testing.md#behavioral-verification runSingularRule exercises the authored fixture. Assert the anonymous-default message.
 * @evidence contracts/testing.md#independent-expectations An unnamed class declaration carries the same export and default modifiers as an unnamed function but arrives under a different node kind, so the branch that names neither has to be reached from both. The authored scenario requires this outcome: Assert the anonymous-default message.
 * @evidence contracts/testing.md#distinguishing-cases Default-export an unnamed class. Run the rule. Assert the anonymous-default message.
 * @evidence contracts/testing.md#execution-ownership TestSingularReportsAnonymousDefaultClasses runs as a Go unit entry in the native package. runSingularRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestSingularReportsAnonymousDefaultClasses(t *testing.T) {
  assertReported(
    t,
    runSingularRule(t, "src/Service.ts", `
export default class {}
`),
    "An anonymous default export has no name",
  )
}
