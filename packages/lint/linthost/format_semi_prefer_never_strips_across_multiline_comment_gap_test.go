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
//
// @evidence contracts/testing.md#behavioral-verification format/semi must remove a terminator when the following block comment contains a line break, retaining both assignments and the full multiline note.
// @evidence contracts/testing.md#independent-expectations A line terminator inside a block comment enables ASI under the lexical contract; the independently authored output preserves those comment bytes and declaration separation.
// @evidence contracts/testing.md#distinguishing-cases This changed multiline-comment gap complements the same-line block-comment separator negative, distinguishing comment content rather than merely its token kind.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiPreferNeverStripsAcrossMultilineCommentGap is a public Go unit selected by the lint semantic-unit Evidence claim. The shared syntax-only fixture harness invokes the owning semicolon rule and applies edits for complete literal output comparison in the same Go process without consumer installation, a native product build or a product host.
func TestFormatSemiPreferNeverStripsAcrossMultilineCommentGap(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/semi",
    "a = 1; /* note\nnote */ b = 2\n",
    `{"prefer":"never"}`,
    "a = 1 /* note\nnote */ b = 2\n",
  )
}
