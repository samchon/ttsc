package evidence

import "testing"

/**
 * Verifies `evidence/graph` accepts a citation in the position this rule
 * demands.
 *
 * The founding and later merged-declaration controls identify the declaration; this proves the naming
 * is worth obeying. Without it the rules could agree on a position that the
 * graph then refuses, and each rule's own suite would stay green while an
 * author following one diagnostic was handed another.
 *
 *  1. Cite a Markdown section from the class half of a merged class.
 *  2. Run the graph with a claim selecting `type` hosts.
 *  3. Assert no diagnostic at all.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a `type` claim over src/Sale.ts, where `@evidence docs/spec.md#contract` sits on the class half of a merged class and namespace and a one-heading Markdown reference is owed; assertNoProblems requires an empty list.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the cross-rule contract that the documented rule and the graph agree on the position: the founding (class) declaration is where a citation is accepted, so the position the documented rule demands must discharge the obligation.
 * @evidence contracts/testing.md#distinguishing-cases The citation on the first half with the namespace half carrying only a member block; the graph's rejection of a citation on a later half is owned by the sibling rejecting entry.
 * @evidence contracts/testing.md#execution-ownership TestGraphAcceptsEvidenceOnTheDeclarationDocumentedDemands is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestGraphAcceptsEvidenceOnTheDeclarationDocumentedDemands(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract {#contract}\n",
    "src/Sale.ts": `
/** @evidence docs/spec.md#contract The class half documents this contract. */
export class Sale {
  price: number = 0;
}
export namespace Sale {
  /** Current version. */
  export const version = "1";
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/Sale.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`))
}
