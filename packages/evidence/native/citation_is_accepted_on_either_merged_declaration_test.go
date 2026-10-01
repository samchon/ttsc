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
 * @evidence contracts/testing.md#behavioral-verification For two fixtures (the `@evidence docs/spec.md#sale-price` block on `interface ISale`, and the same block on the merged `namespace ISale`), runIndexRule runs the graph rule with a claim owing that section and each run must report no diagnostic.
 * @evidence contracts/testing.md#independent-expectations The expected silence is authored from the merged-identity contract that a citation is judged on the identity, not on the declaration carrying it, so placement on either half discharges the obligation without a placement diagnostic.
 * @evidence contracts/testing.md#distinguishing-cases The two placements are iterated over a map of named fixtures with the name in the failure message; a rule that accepted only the first declaration would fail the second run, and one that required both would fail both.
 * @evidence contracts/testing.md#execution-ownership TestCitationIsAcceptedOnEitherMergedDeclaration is a Go unit entry in the native test process that loops over two inline fixtures (not t.Run subtests); runIndexRule writes each to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
