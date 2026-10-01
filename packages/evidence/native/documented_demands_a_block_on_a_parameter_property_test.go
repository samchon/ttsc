package evidence

import "testing"

/**
 * Verifies a parameter property needs its own block, and an idiomatic `@param`
 * on the constructor does not stand in for it.
 *
 * This is the one place the rule asks for something a well-documented codebase
 * may not already have, so it is pinned rather than discovered. It is also
 * forced: a constructor's block cannot host a citation for a parameter
 * property, because two of them would leave `@evidence` no way to say which
 * field it means. A field documented only through `@param` therefore genuinely
 * cannot cite anything, which is exactly the silence this rule removes.
 *
 *  1. Document a constructor with `@param` and leave its parameter bare.
 *  2. Run the rule, then run it again with the block moved onto the parameter.
 *  3. Assert the first is reported and the second is silent.
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options twice over class `Sale`: with a `@param price` block on the constructor and a bare `public readonly price` parameter, assertReported requires exactly one diagnostic `Missing JSDoc on exported property 'Sale.prototype.price'`; with the block moved onto the parameter, assertSilent requires none.
 * @evidence contracts/testing.md#independent-expectations The expectations are authored from the documented-rule contract: a constructor block cannot host a citation for a parameter property, so the parameter property itself needs a block, and a `@param` on the constructor does not stand in for it.
 * @evidence contracts/testing.md#distinguishing-cases The same class in a reported form (constructor `@param` only) and an accepted form (block on the parameter), so only the block position differs; a rule that accepted the constructor block would fail the first assertion.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedDemandsABlockOnAParameterProperty is a Go unit entry in the native test process; runDocumentedRule parses each source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
 */
func TestDocumentedDemandsABlockOnAParameterProperty(t *testing.T) {
  assertReported(t, runDocumentedRule(t, "src/Sale.ts", `
/** A sale offered to a customer. */
export class Sale {
  /**
   * Constructs a sale.
   *
   * @param price The amount the customer pays.
   */
  public constructor(public readonly price: number) {}
}
`, ""), "Missing JSDoc on exported property 'Sale.prototype.price'")

  assertSilent(t, runDocumentedRule(t, "src/Sale.ts", `
/** A sale offered to a customer. */
export class Sale {
  public constructor(
    /** The amount the customer pays. */
    public readonly price: number,
  ) {}
}
`, ""))
}
