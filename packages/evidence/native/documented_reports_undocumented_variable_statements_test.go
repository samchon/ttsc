package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies the variable branch still fires when the block is absent.
 *
 * The counterpart to TestDocumentedAcceptsOneBlockForAVariableStatement: skipping the declaration nodes must not turn into
 * skipping variables altogether, which would silently exempt every exported
 * constant in a project.
 *
 *  1. Export two bindings from one undocumented statement.
 *  2. Run the rule.
 *  3. Assert one finding naming both bindings.
 *
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over an undocumented `export const maximumItems = 10, maximumCoupons = 2;`; the test requires exactly one message, containing `'maximumItems', 'maximumCoupons'`.
 * @evidence contracts/testing.md#independent-expectations The expected message is authored from the variable-statement contract: two bindings share one block position, so they are one obligation with one repair and are reported together in one diagnostic.
 * @evidence contracts/testing.md#distinguishing-cases The reporting counterpart of the one-block-per-variable-statement accept entry: the count of one fails both if each binding were reported separately and if variables were skipped.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedReportsUndocumentedVariableStatements is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
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
