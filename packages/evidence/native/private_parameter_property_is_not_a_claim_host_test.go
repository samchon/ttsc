package evidence

import (
  "testing"
)

/**
 * Verifies a citation on a non-public parameter property is refused.
 *
 * The unit-set case proves a private parameter property materializes nothing;
 * this proves the host side agrees. A declaration that is not a unit must not
 * be a place a tag can sit either, or an author would write a citation the
 * graph counts for nothing and reports nowhere.
 *
 *  1. Cite a Markdown section from a private parameter property.
 *  2. Evaluate a `symbol: "property"` claim over that file.
 *  3. Assert the unsupported-host diagnostic.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule writes a Markdown spec and a class whose private constructor parameter property carries an @evidence tag, runs graphRule.Check with a property claim, and one reported diagnostic must contain "unsupported or non-exported declaration".
 * @evidence contracts/testing.md#independent-expectations Source, claim configuration and the expected diagnostic fragment are authored literals; that a tag on a declaration that is not a unit must be refused rather than silently counted follows from the host contract, not from a recorded run.
 * @evidence contracts/testing.md#distinguishing-cases The private parameter property is the only negative case; the assertion is a substring match among all diagnostics (assertProblemContains), and the public sibling property in the fixture is not separately asserted as accepted.
 * @evidence contracts/testing.md#execution-ownership TestPrivateParameterPropertyIsNotAClaimHost runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestPrivateParameterPropertyIsNotAClaimHost(t *testing.T) {
  assertProblemContains(t, runIndexRule(t, map[string]string{
    "docs/spec.md": "## Price {#price}\n\nThe amount the customer pays.\n",
    "src/Sale.ts": `
export class Sale {
  public readonly total: number = 0;
  constructor(
    /** @evidence docs/spec.md#price A private field hosts nothing. */
    private readonly price: number,
  ) {}
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"property",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`), "unsupported or non-exported declaration")
}
