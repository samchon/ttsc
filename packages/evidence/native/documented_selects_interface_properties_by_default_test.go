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
 *
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over a documented `interface ISale` with a documented `id` and an undocumented `price`; assertReported requires exactly one diagnostic, `Missing JSDoc on exported property 'ISale.price'`.
 * @evidence contracts/testing.md#independent-expectations The expected report is authored from the population contract: a property is a claim host, so the default selection must include it and report an undocumented one.
 * @evidence contracts/testing.md#distinguishing-cases One documented and one undocumented property of the same documented interface: the exactly-one result shows the default selection reaches properties without over-reporting the documented ones.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedSelectsInterfacePropertiesByDefault is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
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
