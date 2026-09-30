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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert the unsupported-host diagnostic.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The unit-set case proves a private parameter property materializes nothing; this proves the host side agrees. A declaration that is not a unit must not be a place a tag can sit either, or an author would write a citation the graph counts for nothing and reports nowhere. The authored scenario requires this outcome: Assert the unsupported-host diagnostic.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Cite a Markdown section from a private parameter property. Evaluate a `symbol: "property"` claim over that file. Assert the unsupported-host diagnostic.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestPrivateParameterPropertyIsNotAClaimHost runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
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
