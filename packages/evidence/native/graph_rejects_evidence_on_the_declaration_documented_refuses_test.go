package evidence

import "testing"

/**
 * Verifies the graph rejects a citation on a declaration this rule refuses.
 *
 * The negative twin that makes the agreement falsifiable. An enum is now the
 * shape that materializes no unit, so it is the one declaration `documented`
 * asks nothing of and the graph refuses a tag on. If an enum ever became a
 * unit, this case fails and both rules should be revisited together rather
 * than one silently drifting from the other.
 *
 *  1. Cite the same section from a class and from an enum in the same file.
 *  2. Run the graph with the same claim.
 *  3. Assert the out-of-scope host diagnostic for the enum.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies the graph rejects a citation on a declaration this rule refuses. The original assertions check assert the out-of-scope host diagnostic for the enum.
 * @evidence contracts/testing.md#independent-expectations The negative twin that makes the agreement falsifiable. An enum is now the shape that materializes no unit, so it is the one declaration `documented` asks nothing of and the graph refuses a tag on. If an enum ever became a unit, this case fails and both rules should be revisited together rather than one silently drifting from the other. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Cite the same section from a class and from an enum in the same file. Run the graph with the same claim. Assert the out-of-scope host diagnostic for the enum. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestGraphRejectsEvidenceOnTheDeclarationDocumentedRefuses is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestGraphRejectsEvidenceOnTheDeclarationDocumentedRefuses(t *testing.T) {
  assertProblemContains(t, runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract {#contract}\n",
    "src/Sale.ts": `
/** @evidence docs/spec.md#contract The class founds the identity and hosts this. */
export class Sale {
  price: number = 0;
}
/** @evidence docs/spec.md#contract An enum materializes no unit, so it hosts nothing. */
export enum Status {
  Draft = "draft",
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/Sale.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`), "unsupported or non-exported declaration")
}
