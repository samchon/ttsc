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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a type claim over src/Sale.ts, which cites `docs/spec.md#contract` on `export class Sale` and on `export enum Status`; assertProblemContains requires a diagnostic containing `unsupported or non-exported declaration`.
 * @evidence contracts/testing.md#independent-expectations The expected message is authored from the host contract: an enum materializes no unit, so it is the declaration both the documented rule asks nothing of and the graph refuses a tag on; a change that made an enums a unit would break this case and the two rules should then be revisited together.
 * @evidence contracts/testing.md#distinguishing-cases A class (a valid host) and an enum (refused) citing the same section in one file; only containment of the refusal wording is asserted, so which declaration it names is not pinned.
 * @evidence contracts/testing.md#execution-ownership TestGraphRejectsEvidenceOnTheDeclarationDocumentedRefuses is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
