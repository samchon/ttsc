package evidence

import (
  "testing"
)

/**
 * Verifies a tag-shaped line inside a template literal is not reported.
 *
 * A comment is a lexical question the parser owns, not a search for slashes:
 * inside a template literal the same bytes are ordinary text. Reporting one
 * would be a diagnostic about a string, naming a repair that would corrupt it.
 * This is what the parser-aware comment enumeration buys, and it is the case
 * that fails first if the scan is ever replaced with one over raw text.
 *
 *  1. Write a line opening with a citation inside a template literal.
 *  2. Evaluate the same claim.
 *  3. Assert nothing is reported.
 *
 * @evidence contracts/testing.md#behavioral-verification runUnreadableRule returns no problems for an exported template literal containing a line shaped like an evidence tag.
 * @evidence contracts/testing.md#independent-expectations Template contents are string data rather than comment tokens. The valid documentation citation discharges pricing; reporting the embedded line would violate lexical comment boundaries.
 * @evidence contracts/testing.md#distinguishing-cases The template contains the same tag spelling as documentation, but its location changes the expected result to silence. Line-comment siblings own actual unreadable comments.
 * @evidence contracts/testing.md#execution-ownership TestATagShapedLineInATemplateIsNotReported is the Go unit entry discovered beside the native package. runUnreadableRule parses the authored TypeScript fixture and checks its graph in that process; the helper owns the shared satisfied pricing section, while this entry owns its comment positions and assertions.
 */
func TestATagShapedLineInATemplateIsNotReported(t *testing.T) {
  assertNoProblems(t, runUnreadableRule(t, "/** @evidence docs/spec.md#pricing The declaration cites this. */\n"+
    "export const limit = `\n"+
    "@evidence docs/spec.md#pricing Prose that merely looks like a tag.\n"+
    "`;\n"))
}
