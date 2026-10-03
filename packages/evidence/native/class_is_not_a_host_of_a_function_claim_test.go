package evidence

import "testing"

/**
 * Verifies a class is not a host a function claim can use.
 *
 * The other half of the adoption promise, and the half nothing enforced:
 * registering the class as a `function` host beside its `type` one passed the
 * entire suite. A claim that selected methods would then silently accept a
 * citation on the class, so an existing configuration would start counting an
 * acknowledgement it never asked for.
 *
 *  1. Cite a Markdown section from the class under a `symbol: "function"` claim.
 *  2. Keep a method as the live host, so the claim is active either way.
 *  3. Assert the class citation is refused and the section stays unacknowledged.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule evaluates a citation on Sale while charge keeps the function claim active; host refusal and missing Charge are required.
 * @evidence contracts/testing.md#independent-expectations A class is a type host, so a function selector cannot accept its citation even when methods are selected.
 * @evidence contracts/testing.md#distinguishing-cases The live method distinguishes selector refusal from claim deactivation; assertions require both consequences without an exact total count.
 * @evidence contracts/testing.md#execution-ownership TestClassIsNotAHostOfAFunctionClaim is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestClassIsNotAHostOfAFunctionClaim(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Charge {#charge}\n\nHow a sale is charged.\n",
    "src/Sale.ts": `
/** @evidence docs/spec.md#charge A class hosts nothing a function claim reads. */
export class Sale {
  charge(): void {}
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "host kind 'type' is not selected (function)")
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/spec.md#charge'")
}
