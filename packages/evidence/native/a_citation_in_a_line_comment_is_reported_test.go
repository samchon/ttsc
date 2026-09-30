package evidence

import (
  "testing"
)

/**
 * Verifies a citation in a line comment is reported.
 *
 * TypeScript discards `//` as documentation, so a tag there is unreadable in
 * exactly the way the pattern shapes are, and it is one keystroke from a block
 * that would work. The decision to report it is stated here rather than left to
 * be inferred from the parser's behavior.
 *
 *  1. Write a citation in a line comment above a declaration.
 *  2. Evaluate the same claim.
 *  3. Assert the tag is reported.
 * @evidence contracts/testing.md#behavioral-verification runUnreadableRule must include the unreadable citation diagnostic at authored source line 4 for a line comment above an export.
 * @evidence contracts/testing.md#independent-expectations A // comment is not TypeScript JSDoc, so its tag must be reported rather than accepted. The fixture line number and literal diagnostic clause do not come from the scanner.
 * @evidence contracts/testing.md#distinguishing-cases An attached citation on limit is the valid control; other carries the unreadable line comment. The subset assertion checks that diagnostic without requiring an otherwise empty report.
 * @evidence contracts/testing.md#execution-ownership TestACitationInALineCommentIsReported is the Go unit entry discovered beside the native package. runUnreadableRule parses the authored TypeScript fixture and checks its graph in that process; the helper owns the shared satisfied pricing section, while this entry owns its comment positions and assertions.
 */
func TestACitationInALineCommentIsReported(t *testing.T) {
  assertReportedAmong(t, runUnreadableRule(t, `/** @evidence docs/spec.md#pricing The declaration cites this. */
export const limit = 1;

// @evidence docs/spec.md#pricing A tag nothing reads.
export const other = 2;
`), "Unreadable @evidence at src/contracts.ts:4")
}
