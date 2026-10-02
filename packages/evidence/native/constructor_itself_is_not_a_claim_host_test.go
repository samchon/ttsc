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
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a property claim over a class whose constructor `constructor(public readonly price: number) {}` carries `@evidence docs/spec.md#price` in the block above it; assertProblemContains requires the diagnostic `unsupported or non-exported declaration`.
 * @evidence contracts/testing.md#independent-expectations The expected diagnostic is authored from the host contract: a constructor materializes no unit, so a tag written above it has no host and must be reported rather than silently credited with the parameter property's obligation.
 * @evidence contracts/testing.md#distinguishing-cases The tag is placed one level too high (on the constructor rather than on its parameter); the sibling parameter-property citation case is owned by another entry. Only containment of the diagnostic is asserted, not that the price section is also reported missing.
 * @evidence contracts/testing.md#execution-ownership TestConstructorItselfIsNotAClaimHost is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
