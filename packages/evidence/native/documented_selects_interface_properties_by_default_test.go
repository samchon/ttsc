package evidence

import "testing"

/**
 * Verifies interface properties are selected by default.
 *
 * A property is a claim host, so it belongs to the population that must be able
 * to carry a tag. Leaving it out of the default would let a property be
 * obligated by the graph while this rule reported the file as fine.
 *
 *  1. Document an interface but leave one property bare.
 *  2. Run the rule with the default selection.
 *  3. Assert the property is reported.
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies interface properties are selected by default. The original assertions check assert the property is reported.
 * @evidence contracts/testing.md#independent-expectations A property is a claim host, so it belongs to the population that must be able to carry a tag. Leaving it out of the default would let a property be obligated by the graph while this rule reported the file as fine. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Document an interface but leave one property bare. Run the rule with the default selection. Assert the property is reported. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedSelectsInterfacePropertiesByDefault is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDocumentedSelectsInterfacePropertiesByDefault(t *testing.T) {
  messages := runDocumentedRule(t, "src/ISale.ts", `
/** A sale offered to a customer. */
export interface ISale {
  /** Identifier of the sale. */
  id: string;
  price: number;
}
`, "")
  assertReported(t, messages, "Missing JSDoc on exported property 'ISale.price'")
}
