package evidence

import "testing"

/**
 * Verifies both halves carrying a block is not a problem.
 *
 * The first declaration decides, and nothing polices the rest. A rule that
 * counted blocks would report the common case of a companion namespace
 * explaining itself, which is documentation the author meant to write.
 *
 *  1. Document both halves of a merged identity.
 *  2. Run the rule.
 *  3. Assert silence.
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies both halves carrying a block is not a problem. The original assertions check assert silence.
 * @evidence contracts/testing.md#independent-expectations The first declaration decides, and nothing polices the rest. A rule that counted blocks would report the common case of a companion namespace explaining itself, which is documentation the author meant to write. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Document both halves of a merged identity. Run the rule. Assert silence. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedAcceptsBothHalvesOfAMergedIdentityDocumented is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDocumentedAcceptsBothHalvesOfAMergedIdentityDocumented(t *testing.T) {
  assertSilent(t, runDocumentedRule(t, "src/ISale.ts", `
/** A sale offered to a customer. */
export interface ISale {
  /** Identifier of the sale. */
  id: string;
}
/** Companion contracts of a sale. */
export namespace ISale {
  /** Creation input. */
  export interface ICreate {
    /** Identifier of the sale. */
    id: string;
  }
}
`, ""))
}
