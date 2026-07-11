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
func TestFormatSemiPreferNeverKeepsSemiBeforeSameLineCommentGap(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/semi",
    "a = 1; /* note */ b = 2\n",
    `{"prefer":"never"}`,
  )
}
