package linthost

import "testing"

// TestFormatSemiPreferNeverKeepsSemiBeforeSameLineCommentGap verifies a
// `;` followed by a single-line block comment and then a second
// statement on the SAME line is kept under semi:false.
//
// `a = 1; /* note */ b = 2` stays on one line because
// format/statement-split deliberately abstains when a block comment
// sits in the inter-statement gap, so nothing rescues the line before
// the stripper runs. A comment without a line terminator is not a line
// terminator for ASI (ECMA-262, Comments), so stripping would produce
// the SyntaxError `a = 1 /* note */ b = 2`. The scan must classify the
// comment by content — no newline inside means no newline crossed.
//
//  1. Parse two same-line statements separated by `; /* note */`.
//  2. Run format/semi with prefer:"never".
//  3. Assert zero findings: the `;` is a required separator.
//
// @evidence contracts/testing.md#behavioral-verification format/semi must retain the separator between two same-line assignments despite an intervening single-line block comment.
// @evidence contracts/testing.md#independent-expectations The literal note comment has no line terminator, so ASI cannot replace the semicolon; deleting it would join a=1 and b=2 into invalid source.
// @evidence contracts/testing.md#distinguishing-cases The unchanged same-line-comment negative complements multiline-comment-gap stripping and comment-free newline stripping, distinguishing comment contents from token kind.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiPreferNeverKeepsSemiBeforeSameLineCommentGap is a public Go unit selected by TestSelectedLintUnits. The shared syntax-only harness invokes the owning semicolon rule and observes zero findings in the same Go process, without consumer installation, a native product build or host execution.
func TestFormatSemiPreferNeverKeepsSemiBeforeSameLineCommentGap(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/semi",
    "a = 1; /* note */ b = 2\n",
    `{"prefer":"never"}`,
  )
}
