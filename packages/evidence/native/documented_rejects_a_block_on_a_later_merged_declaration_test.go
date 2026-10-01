package evidence

import "testing"

/**
 * Verifies the rule demands the block where a citation can actually live.
 *
 * A class is a type unit, so `class Sale` beside `namespace Sale` is one
 * identity, founded by whichever half is written first. Here that is the class,
 * because an instantiated namespace above its class is `TS2434`. Naming a later
 * half instead would send an author's block somewhere the identity is not
 * judged from, and this rule's whole job is to name the position a citation can
 * live in.
 *
 *  1. Document only the namespace half of a merged class identity.
 *  2. Run the rule.
 *  3. Assert the identity is still reported, because the class founds it.
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over an undocumented `export class Sale` (documented field) followed by a documented merged `export namespace Sale`; assertReported requires exactly one diagnostic, `Missing JSDoc on exported type 'Sale'`.
 * @evidence contracts/testing.md#independent-expectations The expected report is authored from the founding-declaration contract: the class is written first and so founds the identity, and a block on the later namespace half is not where the identity is judged from.
 * @evidence contracts/testing.md#distinguishing-cases The rejecting counterpart of the founding-declaration accept case, with the documentation placed only on the later half; the exactly-one result also shows the documented members do not cause extra reports.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedRejectsABlockOnALaterMergedDeclaration is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
 */
func TestDocumentedRejectsABlockOnALaterMergedDeclaration(t *testing.T) {
  assertReported(t, runDocumentedRule(t, "src/Sale.ts", `
export class Sale {
  /** Price the customer pays. */
  price: number = 0;
}
/** A sale offered to a customer. */
export namespace Sale {
  /** Current version. */
  export const version = "1";
}
`, ""), "Missing JSDoc on exported type 'Sale'")
}
