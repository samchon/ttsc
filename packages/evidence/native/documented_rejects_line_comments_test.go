package evidence

import "testing"

/**
 * Verifies a line comment does not satisfy the rule.
 *
 * This is the rule's correctness constraint made observable: what it accepts
 * must equal what the tag collector can see. A tag written in a `//` comment is
 * unreadable to the graph, which reports it rather than acting on it, so
 * accepting one here would certify a declaration that can still never cite
 * anything.
 *
 *  1. Precede an export with a line comment carrying a citation.
 *  2. Run the rule.
 *  3. Assert the export is still reported as missing a block.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies a line comment does not satisfy the rule. The original assertions check assert the export is still reported as missing a block.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations This is the rule's correctness constraint made observable: what it accepts must equal what the tag collector can see. A tag written in a `//` comment is unreadable to the graph, which reports it rather than acting on it, so accepting one here would certify a declaration that can still never cite anything. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Precede an export with a line comment carrying a citation. Run the rule. Assert the export is still reported as missing a block. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDocumentedRejectsLineComments is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDocumentedRejectsLineComments(t *testing.T) {
  messages := runDocumentedRule(t, "src/parse.ts", `
// @evidence docs/spec.md#parse The graph reports this tag rather than reading it.
export function parse(value: string): string {
  return value;
}
`, "")
  assertReported(t, messages, "Missing JSDoc on exported function 'parse'")
}
