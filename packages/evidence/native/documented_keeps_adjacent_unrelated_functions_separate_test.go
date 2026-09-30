package evidence

import "testing"

/**
 * Verifies two distinct callables are not merged.
 *
 * The overload run is keyed on the shared name, so adjacent but unrelated
 * functions must stay separate hosts. Merging them would let one block excuse
 * the other.
 *
 *  1. Document the first of two adjacent, differently named functions.
 *  2. Run the rule.
 *  3. Assert the second is still reported.
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies two distinct callables are not merged. The original assertions check assert the second is still reported.
 * @evidence contracts/testing.md#independent-expectations The overload run is keyed on the shared name, so adjacent but unrelated functions must stay separate hosts. Merging them would let one block excuse the other. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Document the first of two adjacent, differently named functions. Run the rule. Assert the second is still reported. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedKeepsAdjacentUnrelatedFunctionsSeparate is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDocumentedKeepsAdjacentUnrelatedFunctionsSeparate(t *testing.T) {
  messages := runDocumentedRule(t, "src/format.ts", `
/** Renders a value for display. */
export function format(value: string): string {
  return value;
}
export function parse(value: string): string {
  return value;
}
`, "")
  assertReported(t, messages, "Missing JSDoc on exported function 'parse'")
}
