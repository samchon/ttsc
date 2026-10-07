package evidence

import "testing"

/**
 * Verifies a const founds the identity its default export re-exposes.
 *
 * `export default x` declares nothing and materializes no unit, so the const is
 * the natural first declaration and no special case is needed. This is the
 * shape the plugin's own entry point uses.
 *
 *  1. Document the const and leave the default export bare.
 *  2. Run the rule.
 *  3. Assert silence.
 *
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over a documented `export const evidence = {...}` followed by an undocumented `export default evidence;`; assertSilent requires no diagnostics.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the documented-rule contract: `export default x` declares nothing and materializes no unit, so the documented const is the only declaration that needs a block.
 * @evidence contracts/testing.md#distinguishing-cases The bare default export of an already-documented const; the sibling entry that reports a const documented only at its default export is the rejecting counterpart.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedAcceptsAConstDocumentedBeforeItsDefaultExport is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
 */
func TestDocumentedAcceptsAConstDocumentedBeforeItsDefaultExport(t *testing.T) {
  assertSilent(t, runDocumentedRule(t, "src/evidence.ts", `
/** The exported plugin descriptor. */
export const evidence = { name: "evidence" };
export default evidence;
`, ""))
}
