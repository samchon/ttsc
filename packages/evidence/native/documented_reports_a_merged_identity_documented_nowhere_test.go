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
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over an `export interface ISale` and a merged `export namespace ISale`, neither carrying a block of its own (only their members are documented); assertReported requires exactly one diagnostic, `Missing JSDoc on exported type 'ISale'`.
 * @evidence contracts/testing.md#independent-expectations The expected report is authored from the documented-rule contract: a merged identity with no block on its founding declaration is missing documentation, and it is one identity so it is reported once.
 * @evidence contracts/testing.md#distinguishing-cases The no-block case of the merged-identity matrix, the control that keeps the accepting cases from being satisfied by a rule that never reports; the members' blocks do not rescue the identity.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedReportsAMergedIdentityDocumentedNowhere is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
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
