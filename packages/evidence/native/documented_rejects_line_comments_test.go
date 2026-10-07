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
 *
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over an `export function parse` preceded only by a `//` line comment containing an `@evidence` tag; assertReported requires exactly one diagnostic, `Missing JSDoc on exported function 'parse'`.
 * @evidence contracts/testing.md#independent-expectations The expected report is authored from the correctness constraint that the rule accepts only what the tag collector can read: a tag in a `//` comment is unreadable to the graph, so it cannot count as a documentation block.
 * @evidence contracts/testing.md#distinguishing-cases A line comment carrying a citation on an otherwise bare export; the detached block-comment form is covered by the sibling non-JSDoc entry, and the JSDoc form by the accept entries.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedRejectsLineComments is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
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
