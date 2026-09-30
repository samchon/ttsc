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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert silence.
 * @evidence contracts/testing.md#independent-expectations Two tags for one identity are independent acknowledgements of two different targets. A positive duplicate requires the same resolved scope on the same declaration host, so reporting either tag would make the graph disagree with itself about what one identity is allowed to say. The authored scenario requires this outcome: Assert silence.
 * @evidence contracts/testing.md#distinguishing-cases Cite one section from each half of a merged identity. Run the graph over a claim owing both sections. Assert silence.
 * @evidence contracts/testing.md#execution-ownership TestBothMergedDeclarationsMayCarryCitations runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
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
