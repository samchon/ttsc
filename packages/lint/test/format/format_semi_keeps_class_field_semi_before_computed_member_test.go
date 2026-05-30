package linthost

import "testing"

// TestFormatSemiKeepsClassFieldSemiBeforeComputedMember verifies a class
// field's `;` is kept when the next member begins with `[` (a computed
// member name), which would otherwise reparse as an index access on the
// field's value.
//
// `a = 1` followed by `["x"]() {}` must keep the `;`: dropping it yields
// `a = 1\n["x"]()`, parsed as `a = (1["x"])()`. A later field with no
// hazard ahead is still stripped, proving the guard is per-member.
//
//  1. Parse a class: a field before a computed method, then a trailing
//     field before `}`.
//  2. Apply format/semi with prefer:"never".
//  3. Assert the hazardous field keeps its `;` while the trailing field
//     is stripped.
func TestFormatSemiKeepsClassFieldSemiBeforeComputedMember(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/semi",
    "class F {\n  a = 1;\n  [\"x\"]() {}\n  b = 2;\n}\n",
    `{"prefer":"never"}`,
    "class F {\n  a = 1;\n  [\"x\"]() {}\n  b = 2\n}\n",
  )
}
