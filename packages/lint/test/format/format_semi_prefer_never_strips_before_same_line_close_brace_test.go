package linthost

import "testing"

// TestFormatSemiPreferNeverStripsBeforeSameLineCloseBrace verifies a `;`
// whose next significant token is a same-line `}` is still stripped
// under semi:false.
//
// The same-line hazard guard must not over-reach: ASI's closing-brace
// rule applies regardless of line structure, so `{ a() }` is valid and
// Prettier prints it without the terminator. This is the negative twin
// of the same-line `else` / `do…while` cases — `}` is the one same-line
// successor that keeps the strip safe.
//
//  1. Parse `if (x) { a(); }` (single line).
//  2. Apply format/semi with prefer:"never".
//  3. Assert the `;` before the same-line `}` is stripped.
func TestFormatSemiPreferNeverStripsBeforeSameLineCloseBrace(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/semi",
    "if (x) { a(); }\n",
    `{"prefer":"never"}`,
    "if (x) { a() }\n",
  )
}
