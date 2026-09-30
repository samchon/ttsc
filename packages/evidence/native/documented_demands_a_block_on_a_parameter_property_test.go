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
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies a parameter property needs its own block, and an idiomatic `@param` on the constructor does not stand in for it. The original assertions check assert the first is reported and the second is silent.
 * @evidence contracts/testing.md#independent-expectations This is the one place the rule asks for something a well-documented codebase may not already have, so it is pinned rather than discovered. It is also forced: a constructor's block cannot host a citation for a parameter property, because two of them would leave `@evidence` no way to say which field it means. A field documented only through `@param` therefore genuinely cannot cite anything, which is exactly the silence this rule removes. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Document a constructor with `@param` and leave its parameter bare. Run the rule, then run it again with the block moved onto the parameter. Assert the first is reported and the second is silent. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedDemandsABlockOnAParameterProperty is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
