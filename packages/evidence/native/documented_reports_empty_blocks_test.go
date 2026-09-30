package evidence

import "testing"

/**
 * Verifies an empty block gets its own diagnostic.
 *
 * A block with neither prose nor tag satisfies nothing, but reporting it as
 * "missing" would confuse a reader looking straight at one. The separate
 * message also keeps the emptiness check visibly structural rather than a
 * judgment about what was written.
 *
 *  1. Document an export with an empty block.
 *  2. Run the rule.
 *  3. Assert the emptiness message rather than the missing one.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies an empty block gets its own diagnostic. The original assertions check assert the emptiness message rather than the missing one.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A block with neither prose nor tag satisfies nothing, but reporting it as "missing" would confuse a reader looking straight at one. The separate message also keeps the emptiness check visibly structural rather than a judgment about what was written. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Document an export with an empty block. Run the rule. Assert the emptiness message rather than the missing one. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDocumentedReportsEmptyBlocks is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDocumentedReportsEmptyBlocks(t *testing.T) {
  messages := runDocumentedRule(t, "src/parse.ts", `
/** */
export function parse(value: string): string {
  return value;
}
`, "")
  assertReported(t, messages, "Empty JSDoc on exported function 'parse'")
}
