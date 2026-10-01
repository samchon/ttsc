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
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over a documented `export function format` followed by an undocumented `export function parse`; assertReported requires exactly one diagnostic, `Missing JSDoc on exported function 'parse'`.
 * @evidence contracts/testing.md#independent-expectations The expected report is authored from the documented-rule contract: only identical names form an overload set, so adjacent functions with different names are separate hosts and one block cannot excuse the other.
 * @evidence contracts/testing.md#distinguishing-cases Two adjacent single-signature functions with different names; the overload-set cases that must share one identity are owned by sibling entries, and the exactly-one assertion fails if `format` is reported or if `parse` is excused.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedKeepsAdjacentUnrelatedFunctionsSeparate is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
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
