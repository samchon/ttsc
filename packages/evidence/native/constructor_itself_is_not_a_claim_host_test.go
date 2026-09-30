package evidence

import (
  "testing"
)

/**
 * Verifies a citation on the constructor itself is refused.
 *
 * The twin of the complementary case, and the boundary between them. A constructor
 * materializes no unit, so a block above it hosts nothing, and an author who
 * put the tag one line too high has to be told rather than silently credited
 * with the parameter's obligation.
 *
 *  1. Cite the same section from the constructor rather than its parameter.
 *  2. Evaluate the same claim.
 *  3. Assert the unsupported-host diagnostic.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert the unsupported-host diagnostic.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The twin of the complementary case, and the boundary between them. A constructor materializes no unit, so a block above it hosts nothing, and an author who put the tag one line too high has to be told rather than silently credited with the parameter's obligation. The authored scenario requires this outcome: Assert the unsupported-host diagnostic.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Cite the same section from the constructor rather than its parameter. Evaluate the same claim. Assert the unsupported-host diagnostic.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestConstructorItselfIsNotAClaimHost runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestConstructorItselfIsNotAClaimHost(t *testing.T) {
  assertProblemContains(t, runIndexRule(t, map[string]string{
    "docs/spec.md": "## Price {#price}\n\nThe amount the customer pays.\n",
    "src/Sale.ts": `
export class Sale {
  /** @evidence docs/spec.md#price A constructor hosts nothing. */
  constructor(public readonly price: number) {}
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"property",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`), "unsupported or non-exported declaration")
}
