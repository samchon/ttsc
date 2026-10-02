package evidence

import (
  "testing"
)

/**
 * Verifies both halves may carry a citation without colliding.
 *
 * Two tags for one identity are independent acknowledgements of two different
 * targets. A positive duplicate requires the same resolved scope on the same
 * declaration host, so reporting either tag would make the graph disagree with
 * itself about what one identity is allowed to say.
 *
 *  1. Cite one section from each half of a merged identity.
 *  2. Run the graph over a claim owing both sections.
 *  3. Assert silence.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a claim over src/** selecting type, function and property units and a Markdown reference over docs/spec.md (headings sale-price and discount), over `interface ISale` cited with #sale-price and the merged `namespace ISale` cited with #discount; assertNoProblems requires an empty diagnostic list.
 * @evidence contracts/testing.md#independent-expectations The expectation follows from the merged-identity contract that two tags on one identity are independent acknowledgements of different targets, so neither tag may be reported as a duplicate or conflict; both sections being cited also leaves nothing owed.
 * @evidence contracts/testing.md#distinguishing-cases One citation on each half of the merged identity with different targets; a duplicate on the same target and a conflicting exclusion are owned by sibling entries, and silence here fails if either half's tag were rejected or if the second half's acknowledgement were not credited.
 * @evidence contracts/testing.md#execution-ownership TestBothMergedDeclarationsMayCarryCitations is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory, parses them and calls the graph rule directly, with no consumer install or product host.
 */
func TestBothMergedDeclarationsMayCarryCitations(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Sale Price {#sale-price}\n\n## Discount {#discount}\n",
    "src/ISale.ts": `
/** @evidence docs/spec.md#sale-price The contract mirrors this pricing rule. */
export interface ISale {
  price: number;
}
/** @evidence docs/spec.md#discount The companion mirrors the discount rule. */
export namespace ISale {
  export interface ICreate {
    price: number;
  }
}
`,
  }, mergedIdentityGraphConfig)
  assertNoProblems(t, messages)
}
