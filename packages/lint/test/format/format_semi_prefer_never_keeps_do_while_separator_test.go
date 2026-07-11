package linthost

import "testing"

// TestFormatSemiPreferNeverKeepsDoWhileSeparator verifies the `;` between
// a single-statement do-body and its same-line `while` is kept under
// semi:false.
//
// In `do f(); while (x);` the first `;` terminates the body expression
// statement; without a line terminator before `while`, ASI cannot
// replace it, so stripping yields the SyntaxError `do f() while (x)`.
// The statement's own trailing `;` at end of file stays strippable —
// this is the positive/negative pair inside one fixture.
//
//  1. Parse `do f(); while (x);` (single line).
//  2. Apply format/semi with prefer:"never".
//  3. Assert the body separator survives and only the do-statement's
//     final `;` is stripped.
func TestFormatSemiPreferNeverKeepsDoWhileSeparator(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/semi",
    "do f(); while (x);\n",
    `{"prefer":"never"}`,
    "do f(); while (x)\n",
  )
}
