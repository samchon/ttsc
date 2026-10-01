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
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over a bare `export interface ISale` (documented `id`) followed by a documented merged `export namespace ISale`; assertReported requires exactly one diagnostic, `Missing JSDoc on exported type 'ISale'`.
 * @evidence contracts/testing.md#independent-expectations The expected report is authored from the founding-declaration contract: the first declaration is the basis, so a block on a later half must not satisfy it.
 * @evidence contracts/testing.md#distinguishing-cases A block only on the later half of an interface-and-namespace pair; a rule accepting any block of the identity would stay silent here. The class-based form is owned by the sibling later-merged-declaration entry.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedReportsAMergedIdentityDocumentedOnlyLater is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
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
