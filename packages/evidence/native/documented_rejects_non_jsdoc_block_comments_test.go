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
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over an `export function parse` preceded only by a `/* ... *\/` (non-JSDoc) block comment containing an `@evidence` tag; assertReported requires exactly one diagnostic, `Missing JSDoc on exported function 'parse'`.
 * @evidence contracts/testing.md#independent-expectations The expected report is authored from the same constraint as the line-comment case: a block comment that is not a JSDoc block is unreadable to the tag collector, so it must not satisfy the rule.
 * @evidence contracts/testing.md#distinguishing-cases A non-JSDoc block comment on an otherwise bare export, the syntactic neighbor of the `//` form owned by a sibling entry.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedRejectsNonJsdocBlockComments is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
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
