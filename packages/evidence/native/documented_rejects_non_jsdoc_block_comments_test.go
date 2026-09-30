package evidence

import "testing"

/**
 * Verifies a detached block comment does not satisfy the rule.
 *
 * The twin of the line-comment case one syntax away: a `/* *\/` block that is
 * not a JSDoc block is equally unreadable to the tag collector.
 *
 *  1. Precede an export with a non-JSDoc block comment.
 *  2. Run the rule.
 *  3. Assert the export is still reported.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies a detached block comment does not satisfy the rule. The original assertions check assert the export is still reported.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The twin of the line-comment case one syntax away: a `/* *\/` block that is not a JSDoc block is equally unreadable to the tag collector. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Precede an export with a non-JSDoc block comment. Run the rule. Assert the export is still reported. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDocumentedRejectsNonJsdocBlockComments is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDocumentedRejectsNonJsdocBlockComments(t *testing.T) {
  messages := runDocumentedRule(t, "src/parse.ts", `
/* @evidence docs/spec.md#parse The graph reports this tag rather than reading it. */
export function parse(value: string): string {
  return value;
}
`, "")
  assertReported(t, messages, "Missing JSDoc on exported function 'parse'")
}
