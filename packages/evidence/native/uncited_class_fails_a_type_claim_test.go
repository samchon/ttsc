package evidence

import "testing"

/**
 * Verifies the same class without a citation fails the same claim.
 *
 * The firing twin. Without it, a claim that had stopped selecting classes
 * entirely would look identical to one they satisfy, because an unselected host
 * is silent in exactly the same way a satisfied one is.
 *
 *  1. Remove the citation and leave the class otherwise unchanged.
 *  2. Evaluate the same claim.
 *  3. Assert the section is reported unacknowledged.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule selects an undocumented Sale class and requires the missing Sale-section diagnostic.
 * @evidence contracts/testing.md#independent-expectations A selected class with no citation owes the authored Sale H2; the expected target is literal.
 * @evidence contracts/testing.md#distinguishing-cases Removing the class citation exercises the firing twin of ClassCitationSatisfiesATypeClaim; extra diagnostics are not counted here.
 * @evidence contracts/testing.md#execution-ownership TestUncitedClassFailsATypeClaim is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestUncitedClassFailsATypeClaim(t *testing.T) {
  assertProblemContains(t, runIndexRule(t, map[string]string{
    "docs/spec.md": "## Sale {#sale}\n\nA sale offered to a customer.\n",
    "src/Sale.ts": `
/** A sale offered to a customer. */
export class Sale {
  price: number = 0;
}
`,
  }, classTypeClaimConfig), "Missing acknowledgement for 'docs/spec.md#sale'")
}
