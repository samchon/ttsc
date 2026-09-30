package evidence

import (
  "testing"
)

/**
 * Verifies a citation is accepted on either declaration of a merged identity.
 *
 * The graph judges the relation on the identity, not on the declaration that
 * happens to carry the tag, so both placements resolve and both discharge the
 * obligation. This is the property that lets the rule stay silent about
 * placement instead of policing it with a diagnostic of its own, and it was
 * never asserted.
 *
 *  1. Cite the same section from the first declaration, then from the second.
 *  2. Run the graph over a claim owing that section.
 *  3. Assert both are silent.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert both are silent.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The graph judges the relation on the identity, not on the declaration that happens to carry the tag, so both placements resolve and both discharge the obligation. This is the property that lets the rule stay silent about placement instead of policing it with a diagnostic of its own, and it was never asserted. The authored scenario requires this outcome: Assert both are silent.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Cite the same section from the first declaration, then from the second. Run the graph over a claim owing that section. Assert both are silent.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestCitationIsAcceptedOnEitherMergedDeclaration runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestCitationIsAcceptedOnEitherMergedDeclaration(t *testing.T) {
  for name, source := range map[string]string{
    "on the first declaration": `
/** @evidence docs/spec.md#sale-price The contract mirrors this pricing rule. */
export interface ISale {
  price: number;
}
export namespace ISale {
  export interface ICreate {
    price: number;
  }
}
`,
    "on the second declaration": `
export interface ISale {
  price: number;
}
/** @evidence docs/spec.md#sale-price The contract mirrors this pricing rule. */
export namespace ISale {
  export interface ICreate {
    price: number;
  }
}
`,
  } {
    messages := runIndexRule(t, map[string]string{
      "docs/spec.md": "## Sale Price {#sale-price}\n",
      "src/ISale.ts": source,
    }, mergedIdentityGraphConfig)
    if len(messages) != 0 {
      t.Fatalf("%s: a citation must be accepted wherever it sits on a merged identity, got:\n%v", name, messages)
    }
  }
}
