package evidence

import "testing"

/**
 * Verifies the founding declaration satisfies the same pair.
 *
 * The twin of the case above, and the position the rule names. Together they
 * pin which declaration of the pair is demanded rather than leaving it to be
 * rediscovered from the collector's unit model.
 *
 *  1. Document only the class half of a merged class identity.
 *  2. Run the rule.
 *  3. Assert silence.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies the founding declaration satisfies the same pair. The original assertions check assert silence.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The twin of the case above, and the position the rule names. Together they pin which declaration of the pair is demanded rather than leaving it to be rediscovered from the collector's unit model. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Document only the class half of a merged class identity. Run the rule. Assert silence. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDocumentedAcceptsABlockOnTheFoundingDeclaration is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDocumentedAcceptsABlockOnTheFoundingDeclaration(t *testing.T) {
  assertSilent(t, runDocumentedRule(t, "src/Sale.ts", `
/** A sale offered to a customer. */
export class Sale {
  /** Price the customer pays. */
  price: number = 0;
}
export namespace Sale {
  /** Current version. */
  export const version = "1";
}
`, ""))
}
