package evidence

import "testing"

/**
 * Verifies a merged identity documented on its first declaration.
 *
 * The identity's basis is whichever declaration comes first, so this is the
 * shape the rule is written around: one block, on the interface, with the
 * namespace half carrying nothing.
 *
 *  1. Document only the interface half of a merged identity.
 *  2. Run the rule with the default selection.
 *  3. Assert silence.
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies a merged identity documented on its first declaration. The original assertions check assert silence.
 * @evidence contracts/testing.md#independent-expectations The identity's basis is whichever declaration comes first, so this is the shape the rule is written around: one block, on the interface, with the namespace half carrying nothing. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Document only the interface half of a merged identity. Run the rule with the default selection. Assert silence. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedAcceptsAMergedIdentityDocumentedFirst is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDocumentedAcceptsAMergedIdentityDocumentedFirst(t *testing.T) {
  assertSilent(t, runDocumentedRule(t, "src/ISale.ts", `
/** A sale offered to a customer. */
export interface ISale {
  /** Identifier of the sale. */
  id: string;
}
export namespace ISale {
  /** Creation input. */
  export interface ICreate {
    /** Identifier of the sale. */
    id: string;
  }
}
`, ""))
}
