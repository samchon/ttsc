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
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies the rule demands the block where a citation can actually live. The original assertions check assert the identity is still reported, because the class founds it.
 * @evidence contracts/testing.md#independent-expectations A class is a type unit, so `class Sale` beside `namespace Sale` is one identity, founded by whichever half is written first. Here that is the class, because an instantiated namespace above its class is `TS2434`. Naming a later half instead would send an author's block somewhere the identity is not judged from, and this rule's whole job is to name the position a citation can live in. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Document only the namespace half of a merged class identity. Run the rule. Assert the identity is still reported, because the class founds it. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedRejectsABlockOnALaterMergedDeclaration is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
