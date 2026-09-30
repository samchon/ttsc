package evidence

import "testing"

/**
 * Verifies a block on a later half does not satisfy the first declaration.
 *
 * This is the case that pins "the first declaration is the basis" rather than
 * "a block anywhere will do". A rule accepting any block would fall silent
 * here, and the identity a reader meets first would stay unexplained.
 *
 *  1. Leave the interface bare and document the namespace half.
 *  2. Run the rule.
 *  3. Assert the identity is reported.
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies a block on a later half does not satisfy the first declaration. The original assertions check assert the identity is reported.
 * @evidence contracts/testing.md#independent-expectations This is the case that pins "the first declaration is the basis" rather than "a block anywhere will do". A rule accepting any block would fall silent here, and the identity a reader meets first would stay unexplained. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Leave the interface bare and document the namespace half. Run the rule. Assert the identity is reported. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedReportsAMergedIdentityDocumentedOnlyLater is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDocumentedReportsAMergedIdentityDocumentedOnlyLater(t *testing.T) {
  assertReported(t, runDocumentedRule(t, "src/ISale.ts", `
export interface ISale {
  /** Identifier of the sale. */
  id: string;
}
/** A sale offered to a customer. */
export namespace ISale {
  /** Creation input. */
  export interface ICreate {
    /** Identifier of the sale. */
    id: string;
  }
}
`, ""), "Missing JSDoc on exported type 'ISale'")
}
