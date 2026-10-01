package evidence

import "testing"

/**
 * Verifies the founding declaration satisfies the same pair.
 *
 * The counterpart to TestDocumentedRejectsABlockOnALaterMergedDeclaration, and the position the rule names. Together they
 * pin which declaration of the pair is demanded rather than leaving it to be
 * rediscovered from the collector's unit model.
 *
 *  1. Document only the class half of a merged class identity.
 *  2. Run the rule.
 *  3. Assert silence.
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over `export class Sale` and `export namespace Sale`, where the class and its `price` field and the namespace's `version` const carry documentation blocks but the namespace itself has none; assertSilent requires no diagnostics.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the documented-rule contract: a merged identity is judged by its first (founding) declaration, so documenting only the class half satisfies the pair; the companion rejection case for a block only on a later declaration is TestDocumentedRejectsABlockOnALaterMergedDeclaration.
 * @evidence contracts/testing.md#distinguishing-cases A merged class-and-namespace pair with a block on the first declaration only; this is the accepting counterpart of the later-declaration rejection, so silence here fails if the rule demanded a block on every half.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedAcceptsABlockOnTheFoundingDeclaration is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
 */
func TestDocumentedAcceptsABlockOnTheFoundingDeclaration(t *testing.T) {
  assertSilent(t, runDocumentedRule(t, "src/Sale.ts", `
/** A sale offered to a customer. */
export class Sale {
  /** Price the customer pays. */
  price: number = 0;
}
export namespace Sale {
  /** Current version. */
  export const version = "1";
}
`, ""))
}
