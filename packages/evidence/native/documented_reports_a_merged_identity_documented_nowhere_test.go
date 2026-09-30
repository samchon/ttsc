package evidence

import "testing"

/**
 * Verifies a merged identity documented on neither half is reported once.
 *
 * The fourth position of the matrix, and the twin that keeps the accepting
 * cases from being satisfied by a rule that never fires.
 *
 *  1. Document neither half of a merged identity.
 *  2. Run the rule.
 *  3. Assert exactly one finding.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies a merged identity documented on neither half is reported once. The original assertions check assert exactly one finding.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The fourth position of the matrix, and the twin that keeps the accepting cases from being satisfied by a rule that never fires. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Document neither half of a merged identity. Run the rule. Assert exactly one finding. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDocumentedReportsAMergedIdentityDocumentedNowhere is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDocumentedReportsAMergedIdentityDocumentedNowhere(t *testing.T) {
  assertReported(t, runDocumentedRule(t, "src/ISale.ts", `
export interface ISale {
  /** Identifier of the sale. */
  id: string;
}
export namespace ISale {
  /** Current version. */
  export const version = "1";
}
`, ""), "Missing JSDoc on exported type 'ISale'")
}
