package evidence

import "testing"

/**
 * Verifies a class is not a host a property claim can use either.
 *
 * ClassIsNotAHostOfAFunctionClaim closed one selector and left the other
 * open: registering the class as a `property` host also passed the whole
 * suite. Host eligibility has three selectors and the class is a legitimate
 * host of exactly one of them, so a case per selector is what states that,
 * and closing them one at a time is how the second stayed open.
 *
 *  1. Cite a Markdown section from the class under a `symbol: "property"` claim.
 *  2. Keep a field as the live host, so the claim is active either way.
 *  3. Assert the class citation is refused and the section stays unacknowledged.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule evaluates a citation on Sale while price keeps the property claim active; host refusal and missing Price are required.
 * @evidence contracts/testing.md#independent-expectations The property selector admits public fields but does not make the containing class a property host.
 * @evidence contracts/testing.md#distinguishing-cases The selected field makes erroneous acceptance distinguishable from an inactive claim; the function-selector boundary belongs to ClassIsNotAHostOfAFunctionClaim.
 * @evidence contracts/testing.md#execution-ownership TestClassIsNotAHostOfAPropertyClaim is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestClassIsNotAHostOfAPropertyClaim(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Price {#price}\n\nThe amount the customer pays.\n",
    "src/Sale.ts": `
/** @evidence docs/spec.md#price A class hosts nothing a property claim reads. */
export class Sale {
  price: number = 0;
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"property",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "host kind 'type' is not selected (property)")
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/spec.md#price'")
}
