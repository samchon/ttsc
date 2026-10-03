package evidence

import "testing"

/**
 * Verifies one block on a variable statement documents every binding it
 * declares.
 *
 * TypeScript attaches a variable's leading JSDoc to the statement wrapper, not
 * to each declaration, so a rule checking declarations directly would report
 * every documented `export const` in existence.
 *
 *  1. Document one statement declaring two exported bindings.
 *  2. Run the rule.
 *  3. Assert silence.
 *
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over one documented `export const maximumItems = 10, maximumCoupons = 2;` statement; assertSilent requires no diagnostics.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the documented-rule contract: TypeScript attaches a variable's leading JSDoc to the statement, so one block documents every binding the statement declares and neither declarator may be reported.
 * @evidence contracts/testing.md#distinguishing-cases Two bindings in one statement under one block, the shape in which a rule that inspected declarations directly would report the documented statement; the undocumented-statement report case is owned by a sibling entry.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedAcceptsOneBlockForAVariableStatement is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
 */
func TestDocumentedAcceptsOneBlockForAVariableStatement(t *testing.T) {
  assertSilent(t, runDocumentedRule(t, "src/limits.ts", `
/** Ceilings applied to a single order. */
export const maximumItems = 10,
  maximumCoupons = 2;
`, ""))
}
