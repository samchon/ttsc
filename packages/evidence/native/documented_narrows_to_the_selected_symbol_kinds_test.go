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
 *  2. Select only `type`, then select only `function` over the same source.
 *  3. Assert the type selection is silent and the function selection reports only total.
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule over a documented `ISale` interface with an undocumented `price` property and an undocumented `total` function: with `{"symbol":"type"}` assertSilent requires no diagnostics, and with `{"symbol":"function"}` assertReported requires exactly one diagnostic, `Missing JSDoc on exported function 'total'`.
 * @evidence contracts/testing.md#independent-expectations The expectations are authored from the selector contract: the symbol option narrows the demanded population to the selected kinds, so the unselected property and function are not reported under the type selection, and the unselected property is not reported under the function selection.
 * @evidence contracts/testing.md#distinguishing-cases The same source under two selections; a selector that kept the default population would report `total` and `price` under the type selection and `price` under the function selection.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedNarrowsToTheSelectedSymbolKinds is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
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
