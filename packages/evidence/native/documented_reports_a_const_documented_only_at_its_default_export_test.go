package evidence

import "testing"

/**
 * Verifies documenting the default export does not stand in for the const.
 *
 * The re-exposure is not where the identity is declared, so a block there
 * leaves the declaration itself unexplained.
 *
 *  1. Leave the const bare and document its default export.
 *  2. Run the rule.
 *  3. Assert the identity is reported.
 *
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over an undocumented `export const evidence = {...}` followed by a documented `export default evidence;`; assertReported requires exactly one diagnostic, `Missing JSDoc on exported property 'evidence'`.
 * @evidence contracts/testing.md#independent-expectations The expected report is authored from the documented-rule contract: a default export re-exposes the const and declares nothing, so a block there does not document the const's declaration.
 * @evidence contracts/testing.md#distinguishing-cases The rejecting counterpart of the const-documented-before-its-default-export accept entry, with the block moved to the default export.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedReportsAConstDocumentedOnlyAtItsDefaultExport is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
 */
func TestDocumentedReportsAConstDocumentedOnlyAtItsDefaultExport(t *testing.T) {
  assertReported(t, runDocumentedRule(t, "src/evidence.ts", `
export const evidence = { name: "evidence" };
/** The exported plugin descriptor. */
export default evidence;
`, ""), "Missing JSDoc on exported property 'evidence'")
}
