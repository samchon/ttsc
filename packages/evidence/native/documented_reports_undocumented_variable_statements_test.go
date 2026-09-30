package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies the variable branch still fires when the block is absent.
 *
 * The twin of the case above: skipping the declaration nodes must not turn into
 * skipping variables altogether, which would silently exempt every exported
 * constant in a project.
 *
 *  1. Export two bindings from one undocumented statement.
 *  2. Run the rule.
 *  3. Assert one finding naming both bindings.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies the variable branch still fires when the block is absent. The original assertions check assert one finding naming both bindings.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The twin of the case above: skipping the declaration nodes must not turn into skipping variables altogether, which would silently exempt every exported constant in a project. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Export two bindings from one undocumented statement. Run the rule. Assert one finding naming both bindings. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDocumentedReportsUndocumentedVariableStatements is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDocumentedReportsUndocumentedVariableStatements(t *testing.T) {
  messages := runDocumentedRule(t, "src/limits.ts", `
export const maximumItems = 10,
  maximumCoupons = 2;
`, "")
  if len(messages) != 1 {
    t.Fatalf("expected one finding, got %d:\n%s", len(messages), strings.Join(messages, "\n"))
  }
  assertReported(t, messages, "'maximumItems', 'maximumCoupons'")
}
