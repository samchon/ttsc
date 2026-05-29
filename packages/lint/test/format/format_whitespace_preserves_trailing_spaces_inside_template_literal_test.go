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
func TestFormatWhitespacePreservesTrailingSpacesInsideTemplateLiteral(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/whitespace",
    "const t = `line  \nnext`;\nconst a = 1;  \n",
    "const t = `line  \nnext`;\nconst a = 1;\n",
  )
}
