package evidence

import "testing"

/**
 * Verifies a function claim over class methods is unaffected by the class unit.
 *
 * The adoption promise of this change is that an existing configuration keeps
 * working. A `symbol: "function"` claim selects the methods and not the class,
 * so the class adds no obligation beside them.
 *
 * The uncited second section keeps that promise checkable. A claim whose
 * selected hosts all vanish goes inactive and reports nothing, so asserting
 * silence would pass just as well if class methods stopped being function units
 * at all, which is the opposite of the promise. Demanding that exactly the
 * uncited section is reported proves the method was a live host and the class
 * added nothing beside it. The other half of the promise, that the class is not
 * a host such a claim can use, is covered by ClassIsNotAHostOfAFunctionClaim.
 *
 *  1. Cite one of two Markdown sections from a method, leaving the class
 *     undocumented.
 *  2. Evaluate a `symbol: "function"` claim.
 *  3. Assert the uncited section is the only thing reported.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule selects charge as a function host; assertReported requires exactly the uncited H2 finding.
 * @evidence contracts/testing.md#independent-expectations The method can acknowledge Charge under a function claim; the containing class contributes no additional function obligation.
 * @evidence contracts/testing.md#distinguishing-cases The uncited second section prevents disappearance of all method hosts from masquerading as success.
 * @evidence contracts/testing.md#execution-ownership TestFunctionClaimOverClassMethodsIsUnaffected is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestFunctionClaimOverClassMethodsIsUnaffected(t *testing.T) {
  assertReported(t, runIndexRule(t, map[string]string{
    "docs/spec.md": "## Charge {#charge}\n\nHow a sale is charged.\n\n## Uncited {#uncited}\n\nNothing answers for this.\n",
    "src/Sale.ts": `
export class Sale {
  /** @evidence docs/spec.md#charge Charges the sale as this section describes. */
  charge(): void {}
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`), "Missing acknowledgement for 'docs/spec.md#uncited'")
}
