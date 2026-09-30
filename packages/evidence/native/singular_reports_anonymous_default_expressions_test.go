package evidence

import (
  "testing"
)

/**
 * Verifies the anonymous default diagnostic.
 *
 * An anonymous default exposes something no file name can match and no consumer
 * can address by name, so it needs its own message rather than a mismatch
 * complaint naming an empty identity.
 *
 *  1. Default-export an anonymous arrow function.
 *  2. Run the rule.
 *  3. Assert the anonymous-default message.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runSingularRule exercises the authored fixture. Assert the anonymous-default message.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations An anonymous default exposes something no file name can match and no consumer can address by name, so it needs its own message rather than a mismatch complaint naming an empty identity. The authored scenario requires this outcome: Assert the anonymous-default message.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Default-export an anonymous arrow function. Run the rule. Assert the anonymous-default message.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestSingularReportsAnonymousDefaultExpressions runs as a Go unit entry in the native package. runSingularRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestSingularReportsAnonymousDefaultExpressions(t *testing.T) {
  messages := runSingularRule(t, "src/handler.ts", `
export default (): void => {};
`)
  assertReported(t, messages, "An anonymous default export has no name")
}
