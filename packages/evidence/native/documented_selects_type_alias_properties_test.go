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
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies an object-shaped type alias has its properties selected. The original assertions check assert the property is reported.
 * @evidence contracts/testing.md#independent-expectations The graph materializes those properties as units, so they are hosts, and a rule that only walked interfaces would leave the alias form unguarded. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Leave one property of an exported type alias undocumented. Run the rule. Assert the property is reported. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedSelectsTypeAliasProperties is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
