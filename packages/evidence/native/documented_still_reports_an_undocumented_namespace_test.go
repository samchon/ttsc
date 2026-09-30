package evidence

import "testing"

/**
 * Verifies the merge did not become "never report a namespace".
 *
 * The negative twin of the two cases above. Folding merged declarations into
 * one identity must not exempt a namespace that is genuinely undocumented, or
 * the fix would trade a false positive for a silent miss.
 *
 *  1. Leave a standalone namespace undocumented.
 *  2. Run the rule.
 *  3. Assert it is reported.
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies the merge did not become "never report a namespace". The original assertions check assert it is reported.
 * @evidence contracts/testing.md#independent-expectations The negative twin of the two cases above. Folding merged declarations into one identity must not exempt a namespace that is genuinely undocumented, or the fix would trade a false positive for a silent miss. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Leave a standalone namespace undocumented. Run the rule. Assert it is reported. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedStillReportsAnUndocumentedNamespace is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDocumentedStillReportsAnUndocumentedNamespace(t *testing.T) {
  assertReported(t, runDocumentedRule(t, "src/Orders.ts", `
export namespace Orders {
  /** Current version. */
  export const version = "1";
}
`, ""), "Missing JSDoc on exported type 'Orders'")
}
