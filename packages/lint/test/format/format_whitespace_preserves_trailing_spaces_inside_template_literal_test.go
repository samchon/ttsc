package linthost

import "testing"

// TestFormatWhitespacePreservesTrailingSpacesInsideTemplateLiteral
// verifies formatWhitespace never trims whitespace that lives inside a
// template literal, while still trimming the trailing whitespace of the
// real source line that follows.
//
// Template-literal bytes are significant: trailing spaces before a
// newline inside a “ `...` “ are part of the string value, and
// deleting them would silently change runtime output. This pins the
// template-safety guard — the rule skips any line whose newline falls
// inside a collected template range, yet the trailing spaces after the
// statement's `;` on a later, non-template line are still removed.
//
//  1. Parse a multi-line template whose first line ends in two spaces,
//     followed by a statement that itself has trailing spaces.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the in-template spaces survive and the post-`;` spaces are
//     trimmed.
//
// @evidence contracts/testing.md#behavioral-verification format/whitespace must retain space/tab bytes inside the template while trimming matching whitespace after a separate const declaration.
// @evidence contracts/testing.md#independent-expectations Independent full output literals preserve the entire template string value and modify only the external source tail.
// @evidence contracts/testing.md#distinguishing-cases The original spaces and added mixed-tab/space twin each require an external change and unchanged template payload.
// @evidence contracts/testing.md#execution-ownership TestFormatWhitespacePreservesTrailingSpacesInsideTemplateLiteral is a public Go unit selected by TestSelectedLintUnits. This host owns every literal input and assertion; the shared syntax-only harness invokes the whitespace rule and applies edits for complete output comparisons in the same process without a consumer install, native product build or product host.
func TestFormatWhitespacePreservesTrailingSpacesInsideTemplateLiteral(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/whitespace",
    "const t = `line  \nnext`;\nconst a = 1;  \n",
    "const t = `line  \nnext`;\nconst a = 1;\n",
  )
  assertFixSnapshot(t, "format/whitespace", "const t = `line\t \nnext`;\nconst a = 1;\t \n", "const t = `line\t \nnext`;\nconst a = 1;\n")
}
