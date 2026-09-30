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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies an empty block on the first declaration is reported as empty. The original assertions check assert the emptiness diagnostic.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Only the first declaration is read, so a block with content on a later half cannot rescue it — and the reader is looking straight at a block, which is why the emptiness message exists rather than the missing one. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Leave an empty block on the interface and a real one on the namespace. Run the rule. Assert the emptiness diagnostic. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDocumentedReportsAnEmptyBlockOnTheFirstDeclaration is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
