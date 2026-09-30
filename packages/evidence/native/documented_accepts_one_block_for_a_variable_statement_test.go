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
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies one block on a variable statement documents every binding it declares. The original assertions check assert silence.
 * @evidence contracts/testing.md#independent-expectations TypeScript attaches a variable's leading JSDoc to the statement wrapper, not to each declaration, so a rule checking declarations directly would report every documented `export const` in existence. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Document one statement declaring two exported bindings. Run the rule. Assert silence. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedAcceptsOneBlockForAVariableStatement is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDocumentedAcceptsOneBlockForAVariableStatement(t *testing.T) {
  assertSilent(t, runDocumentedRule(t, "src/limits.ts", `
/** Ceilings applied to a single order. */
export const maximumItems = 10,
  maximumCoupons = 2;
`, ""))
}
