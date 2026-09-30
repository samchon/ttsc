package evidence

import "testing"

/**
 * Verifies the symbol selector narrows the population.
 *
 * Adoption in an existing project depends on this: a team documents types
 * first, then callables, then properties. A selector that silently kept the
 * default would make that impossible and get the rule switched off entirely.
 *
 *  1. Leave an interface property and an exported function undocumented.
 *  2. Select only `type`.
 *  3. Assert neither is reported while the documented type stays silent.
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies the symbol selector narrows the population. The original assertions check assert neither is reported while the documented type stays silent.
 * @evidence contracts/testing.md#independent-expectations Adoption in an existing project depends on this: a team documents types first, then callables, then properties. A selector that silently kept the default would make that impossible and get the rule switched off entirely. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Leave an interface property and an exported function undocumented. Select only `type`. Assert neither is reported while the documented type stays silent. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedNarrowsToTheSelectedSymbolKinds is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDocumentedNarrowsToTheSelectedSymbolKinds(t *testing.T) {
  source := `
/** A sale offered to a customer. */
export interface ISale {
  price: number;
}
export function total(sale: ISale): number {
  return sale.price;
}
`
  assertSilent(t, runDocumentedRule(t, "src/ISale.ts", source, `{"symbol":"type"}`))
  assertReported(
    t,
    runDocumentedRule(t, "src/ISale.ts", source, `{"symbol":"function"}`),
    "Missing JSDoc on exported function 'total'",
  )
}
