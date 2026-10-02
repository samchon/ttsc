package evidence

import (
  "testing"
)

/**
 * Verifies a parameter property carries its own citation.
 *
 * Materializing the unit is only half of the repair. TypeScript attaches a
 * leading block to the parameter rather than to the constructor, and unless
 * the parameter is registered as a claim host too, the field would be visible
 * as evidence while unable to cite anything of its own.
 *
 * The uncited second section is what keeps that checkable. A claim whose
 * selected hosts all vanish deactivates and reports nothing, so asserting
 * silence would pass just as well if parameter properties stopped being units
 * at all. Demanding that exactly the uncited section is reported proves the
 * claim was live and the cited one really was discharged from the parameter.
 *
 *  1. Cite one of two Markdown sections from a parameter property.
 *  2. Evaluate a `symbol: "property"` claim over that file.
 *  3. Assert the uncited section is the only thing reported.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert the uncited section is the only thing reported.
 * @evidence contracts/testing.md#independent-expectations Materializing the unit is only half of the repair. TypeScript attaches a leading block to the parameter rather than to the constructor, and unless the parameter is registered as a claim host too, the field would be visible as evidence while unable to cite anything of its own. The authored scenario requires this outcome: Assert the uncited section is the only thing reported.
 * @evidence contracts/testing.md#distinguishing-cases Cite one of two Markdown sections from a parameter property. Evaluate a `symbol: "property"` claim over that file. Assert the uncited section is the only thing reported.
 * @evidence contracts/testing.md#execution-ownership TestParameterPropertyIsAClaimHost runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestParameterPropertyIsAClaimHost(t *testing.T) {
  assertReported(t, runIndexRule(t, map[string]string{
    "docs/spec.md": "## Price {#price}\n\nThe amount the customer pays.\n\n## Uncited {#uncited}\n\nNothing answers for this.\n",
    "src/Sale.ts": `
export class Sale {
  constructor(
    /** @evidence docs/spec.md#price The price this section fixes. */
    public readonly price: number,
  ) {}
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"property",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`), "Missing acknowledgement for 'docs/spec.md#uncited'")
}
