package evidence

import "testing"

/**
 * Verifies `evidence/graph` accepts a citation in the position this rule
 * demands.
 *
 * The two cases above prove which declaration is named; this proves the naming
 * is worth obeying. Without it the rules could agree on a position that the
 * graph then refuses, and each rule's own suite would stay green while an
 * author following one diagnostic was handed another.
 *
 *  1. Cite a Markdown section from the class half of a merged class.
 *  2. Run the graph with a claim selecting `type` hosts.
 *  3. Assert no diagnostic at all.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies `evidence/graph` accepts a citation in the position this rule demands. The original assertions check assert no diagnostic at all.
 * @evidence contracts/testing.md#independent-expectations The two cases above prove which declaration is named; this proves the naming is worth obeying. Without it the rules could agree on a position that the graph then refuses, and each rule's own suite would stay green while an author following one diagnostic was handed another. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Cite a Markdown section from the class half of a merged class. Run the graph with a claim selecting `type` hosts. Assert no diagnostic at all. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestGraphAcceptsEvidenceOnTheDeclarationDocumentedDemands is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
