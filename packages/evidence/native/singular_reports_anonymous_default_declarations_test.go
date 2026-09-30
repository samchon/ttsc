package evidence

import (
  "testing"
)

/**
 * Verifies the anonymous default diagnostic covers unnamed declarations.
 *
 * `export default function () {}` is a declaration rather than an expression,
 * so it reaches the rule down a different branch than the arrow expression in TestSingularReportsAnonymousDefaultExpressions and would
 * otherwise pass unreported.
 *
 *  1. Default-export an unnamed function declaration.
 *  2. Run the rule.
 *  3. Assert the anonymous-default message.
 * @evidence contracts/testing.md#behavioral-verification runSingularRule exercises the authored fixture. Assert the anonymous-default message.
 * @evidence contracts/testing.md#independent-expectations `export default function () {}` is a declaration rather than an expression, so it reaches the rule down a different branch than the arrow expression in TestSingularReportsAnonymousDefaultExpressions and would otherwise pass unreported. The authored scenario requires this outcome: Assert the anonymous-default message.
 * @evidence contracts/testing.md#distinguishing-cases Default-export an unnamed function declaration. Run the rule. Assert the anonymous-default message.
 * @evidence contracts/testing.md#execution-ownership TestSingularReportsAnonymousDefaultDeclarations runs as a Go unit entry in the native package. runSingularRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestSingularReportsAnonymousDefaultDeclarations(t *testing.T) {
  messages := runSingularRule(t, "src/handler.ts", `
export default function () {}
`)
  assertReported(t, messages, "An anonymous default export has no name")
}
