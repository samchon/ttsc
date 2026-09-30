package evidence

import "testing"

/**
 * Verifies a public class field satisfies a property claim while a private one
 * is not selected at all.
 *
 * `singleEvidencePerSymbol` is what makes the private half falsifiable: it
 * judges every selected host, including the ones carrying no tag, so a private
 * field that had slipped into the population would be reported for citing zero
 * units. Without the policy the two states are indistinguishable.
 *
 * The uncited second section is what makes the public half falsifiable. A claim
 * whose selected hosts all vanish goes inactive and reports nothing, so
 * asserting silence would pass just as well if class fields stopped being
 * property units altogether. Demanding that exactly the uncited section is
 * reported proves the claim was live and the cited one really was discharged.
 *
 *  1. Cite one of two Markdown sections from a public field beside a private
 *     one.
 *  2. Evaluate a `symbol: "property"` claim under singleEvidencePerSymbol.
 *  3. Assert the uncited section is the only thing reported.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule selects public price under singleEvidencePerSymbol; assertReported requires only the uncited section.
 * @evidence contracts/testing.md#independent-expectations Public data is a property host; private ledger is outside that selector, so it must not add a zero-unit cardinality failure.
 * @evidence contracts/testing.md#distinguishing-cases The uncited H2 keeps the claim demonstrably active while the private field challenges erroneous host admission.
 * @evidence contracts/testing.md#execution-ownership TestPublicClassFieldSatisfiesAPropertyClaim is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestPublicClassFieldSatisfiesAPropertyClaim(t *testing.T) {
  assertReported(t, runIndexRule(t, map[string]string{
    "docs/spec.md": "## Price {#price}\n\nThe amount the customer pays.\n\n## Uncited {#uncited}\n\nNothing answers for this.\n",
    "src/Sale.ts": `
export class Sale {
  /** @evidence docs/spec.md#price The price this section fixes. */
  public readonly price: number = 0;
  private ledger: number = 0;
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"property",
    "reference":{
      "type":"markdown",
      "files":["docs/**/*.md"],
      "symbol":"h2",
      "singleEvidencePerSymbol":true
    }
  }]}`), "Missing acknowledgement for 'docs/spec.md#uncited'")
}
