package evidence

import "testing"

/**
 * Verifies an empty block on the first declaration is reported as empty.
 *
 * Only the first declaration is read, so a block with content on a later half
 * cannot rescue it — and the reader is looking straight at a block, which is
 * why the emptiness message exists rather than the missing one.
 *
 *  1. Leave an empty block on the interface and a real one on the namespace.
 *  2. Run the rule.
 *  3. Assert the emptiness diagnostic.
 *
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over an `export interface ISale` preceded by an empty `/** *\/` block and a merged documented `export namespace ISale`; assertReported requires exactly one diagnostic, `Empty JSDoc on exported type 'ISale'`.
 * @evidence contracts/testing.md#independent-expectations The expected message is authored from the documented-rule contract: only the founding declaration is read, so a block with content on a later half cannot rescue an empty first block, and the author is told the block is empty rather than missing.
 * @evidence contracts/testing.md#distinguishing-cases An empty block on the first half against a real block on the second; the plain empty-block and asterisk-only forms are owned by sibling entries, and this case also separates the empty message from the missing message.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedReportsAnEmptyBlockOnTheFirstDeclaration is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
 */
func TestDocumentedReportsAnEmptyBlockOnTheFirstDeclaration(t *testing.T) {
  assertReported(t, runDocumentedRule(t, "src/ISale.ts", `
/** */
export interface ISale {
  /** Identifier of the sale. */
  id: string;
}
/** A sale offered to a customer. */
export namespace ISale {
  /** Creation input. */
  export interface ICreate {
    /** Identifier of the sale. */
    id: string;
  }
}
`, ""), "Empty JSDoc on exported type 'ISale'")
}
