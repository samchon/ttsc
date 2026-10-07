package evidence

import "testing"

/**
 * Verifies a merged identity documented on its first declaration.
 *
 * The identity's basis is whichever declaration comes first, so this is the
 * shape the rule is written around: one block, on the interface, with the
 * namespace half carrying nothing.
 *
 *  1. Document only the interface half of a merged identity.
 *  2. Run the rule with the default selection.
 *  3. Assert silence.
 *
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over a documented `export interface ISale` (with a documented `id`) merged with an undocumented `export namespace ISale` holding a documented `ICreate` interface; assertSilent requires no diagnostics.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the documented-rule contract: the identity is judged by its first declaration, so one block on the interface satisfies the pair and the namespace half owes nothing.
 * @evidence contracts/testing.md#distinguishing-cases A block on the first half only (interface) with no block on the namespace; the both-halves case and the later-only rejection are owned by sibling entries. Silence alone would also occur if the rule ignored merged identities, which the sibling rejection entries guard against.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedAcceptsAMergedIdentityDocumentedFirst is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
 */
func TestDocumentedAcceptsAMergedIdentityDocumentedFirst(t *testing.T) {
  assertSilent(t, runDocumentedRule(t, "src/ISale.ts", `
/** A sale offered to a customer. */
export interface ISale {
  /** Identifier of the sale. */
  id: string;
}
export namespace ISale {
  /** Creation input. */
  export interface ICreate {
    /** Identifier of the sale. */
    id: string;
  }
}
`, ""))
}
