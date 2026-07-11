package linthost

import "testing"

// TestFormatSemiPreferNeverStripsAcrossMultilineCommentGap verifies a `;`
// followed by a block comment that SPANS lines is strippable under
// semi:false.
//
// Per ECMA-262 (Comments), a multi-line comment containing a line
// terminator is treated as a line terminator for ASI, so
// `a = 1 /* note\nnote */ b = 2` parses as two statements. This is the
// negative twin of the same-line comment-gap case: the decision keys on
// the comment's content (does it contain a newline?), not on its token
// kind, so a spanning comment must count as a crossed line.
//
//  1. Parse two statements separated by `;` and a two-line block comment.
//  2. Apply format/semi with prefer:"never".
//  3. Assert the `;` is stripped and the comment survives intact.
func TestFormatSemiPreferNeverStripsAcrossMultilineCommentGap(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/semi",
    "a = 1; /* note\nnote */ b = 2\n",
    `{"prefer":"never"}`,
    "a = 1 /* note\nnote */ b = 2\n",
  )
}
