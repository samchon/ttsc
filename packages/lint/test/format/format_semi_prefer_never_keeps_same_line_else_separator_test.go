package linthost

import "testing"

// TestFormatSemiPreferNeverKeepsSameLineElseSeparator verifies the `;`
// between `if (a) b();` and a same-line `else` is kept under semi:false.
//
// ASI only fires at a line terminator, end of input, or before `}`.
// With `else` on the same line nothing can re-terminate the then-branch
// once the `;` is gone, so `if (a) b() else c()` is a SyntaxError. The
// hazard scan used to treat `\n` as skippable whitespace and never
// required one, so it judged `else` safe and corrupted the source; this
// pins the sawNewline discipline in nextStatementHasASIHazard.
//
//  1. Parse `if (a) b(); else c();` (single line).
//  2. Apply format/semi with prefer:"never".
//  3. Assert only the trailing EOF-adjacent `;` is stripped and the
//     required separator before `else` survives.
func TestFormatSemiPreferNeverKeepsSameLineElseSeparator(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/semi",
    "if (a) b(); else c();\n",
    `{"prefer":"never"}`,
    "if (a) b(); else c()\n",
  )
}
