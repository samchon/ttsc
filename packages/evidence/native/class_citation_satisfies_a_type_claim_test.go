package evidence

import "testing"

/**
 * Verifies a class satisfies a type claim by citing its specification.
 *
 * This is the obligation the class exists to carry: the class states the
 * subject, so the subject is what answers for the document describing it.
 * Before the class was a unit, only its methods could answer, which put the
 * obligation one level below the thing that has it.
 *
 * The uncited second section is what keeps this from passing on an empty
 * population. A claim whose selected hosts all vanish deactivates and reports
 * nothing, so a class that had stopped being a `type` host would leave this
 * green. Demanding that exactly the uncited section is reported proves the
 * claim was live and the cited one really was discharged by the class.
 *
 *  1. Cite one of two Markdown sections from an exported class.
 *  2. Evaluate a `symbol: "type"` claim over that file.
 *  3. Assert the uncited section is the only thing reported.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule selects Sale as a type host and assertReported requires exactly the uncited H2 finding.
 * @evidence contracts/testing.md#independent-expectations The type-host contract lets a class discharge its cited Sale section; Uncited independently remains owed.
 * @evidence contracts/testing.md#distinguishing-cases Two sections prevent a vanished class population from passing through claim deactivation.
 * @evidence contracts/testing.md#execution-ownership TestClassCitationSatisfiesATypeClaim is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestClassCitationSatisfiesATypeClaim(t *testing.T) {
  assertReported(t, runIndexRule(t, map[string]string{
    "docs/spec.md": "## Sale {#sale}\n\nA sale offered to a customer.\n\n## Uncited {#uncited}\n\nNothing answers for this.\n",
    "src/Sale.ts": `
/** @evidence docs/spec.md#sale The sale contract this section specifies. */
export class Sale {
  price: number = 0;
}
`,
  }, classTypeClaimConfig), "Missing acknowledgement for 'docs/spec.md#uncited'")
}
