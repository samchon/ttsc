package linthost

import "testing"

// TestFormatSemiPreferNeverKeepsSameLineStatementSeparator verifies the
// `;` between two statements on the SAME line is kept under semi:false.
//
// `a = 1; b = 2` needs its separator: with no line terminator in the
// gap, ASI cannot fire and `a = 1 b = 2` is a SyntaxError. In the full
// `ttsc format` cascade, format/statement-split later moves `b = 2` to
// its own line and the next pass strips the then-redundant `;` — the
// semi rule must defer to that ordering rather than corrupt the source
// in a single pass. Negative twin of the newline-separated strip pinned
// by TestFormatSemiHonorsPreferNeverOption.
//
//  1. Parse `a = 1; b = 2` (single line).
//  2. Run format/semi with prefer:"never".
//  3. Assert zero findings: the same-line successor keeps the `;`.
func TestFormatSemiPreferNeverKeepsSameLineStatementSeparator(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/semi",
    "a = 1; b = 2\n",
    `{"prefer":"never"}`,
  )
}
