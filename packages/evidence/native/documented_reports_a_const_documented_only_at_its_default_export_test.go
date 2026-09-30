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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies documenting the default export does not stand in for the const. The original assertions check assert the identity is reported.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The re-exposure is not where the identity is declared, so a block there leaves the declaration itself unexplained. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Leave the const bare and document its default export. Run the rule. Assert the identity is reported. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDocumentedReportsAConstDocumentedOnlyAtItsDefaultExport is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDocumentedReportsAConstDocumentedOnlyAtItsDefaultExport(t *testing.T) {
  assertReported(t, runDocumentedRule(t, "src/evidence.ts", `
export const evidence = { name: "evidence" };
/** The exported plugin descriptor. */
export default evidence;
`, ""), "Missing JSDoc on exported property 'evidence'")
}
