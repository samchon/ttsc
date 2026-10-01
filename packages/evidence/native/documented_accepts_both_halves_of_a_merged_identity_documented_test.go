package evidence

import "testing"

/**
 * Verifies both halves carrying a block is not a problem.
 *
 * The first declaration decides, and nothing polices the rest. A rule that
 * counted blocks would report the common case of a companion namespace
 * explaining itself, which is documentation the author meant to write.
 *
 *  1. Document both halves of a merged identity.
 *  2. Run the rule.
 *  3. Assert silence.
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over a documented `export interface ISale` and a documented merged `export namespace ISale` (with documented members); assertSilent requires no diagnostics.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the documented-rule contract: the first declaration decides and nothing polices the others, so a block on a companion namespace as well must not be reported.
 * @evidence contracts/testing.md#distinguishing-cases Both halves carrying a block, which is the case a rule that counted blocks per identity would wrongly report; the first-only and later-only cases are owned by sibling entries.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedAcceptsBothHalvesOfAMergedIdentityDocumented is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
 */
func TestDocumentedAcceptsBothHalvesOfAMergedIdentityDocumented(t *testing.T) {
  assertSilent(t, runDocumentedRule(t, "src/ISale.ts", `
/** A sale offered to a customer. */
export interface ISale {
  /** Identifier of the sale. */
  id: string;
}
/** Companion contracts of a sale. */
export namespace ISale {
  /** Creation input. */
  export interface ICreate {
    /** Identifier of the sale. */
    id: string;
  }
}
`, ""))
}
