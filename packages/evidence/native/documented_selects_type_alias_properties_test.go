package evidence

import "testing"

/**
 * Verifies an object-shaped type alias has its properties selected.
 *
 * The graph materializes those properties as units, so they are hosts, and a
 * rule that only walked interfaces would leave the alias form unguarded.
 *
 *  1. Leave one property of an exported type alias undocumented.
 *  2. Run the rule.
 *  3. Assert the property is reported.
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over a documented `export type Sale = { price: number }`; assertReported requires exactly one diagnostic, `Missing JSDoc on exported property 'Sale.price'`.
 * @evidence contracts/testing.md#independent-expectations The expected name is authored from the unit-model contract: the graph materializes object-type alias members as property units, so the rule must demand them just as it does interface properties.
 * @evidence contracts/testing.md#distinguishing-cases The alias form of an object type with one undocumented member; the interface form is owned by the sibling default-selection entry.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedSelectsTypeAliasProperties is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
 */
func TestDocumentedSelectsTypeAliasProperties(t *testing.T) {
  messages := runDocumentedRule(t, "src/Sale.ts", `
/** A sale offered to a customer. */
export type Sale = {
  price: number;
};
`, "")
  assertReported(t, messages, "Missing JSDoc on exported property 'Sale.price'")
}
