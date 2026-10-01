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
//
// @evidence contracts/testing.md#behavioral-verification format/semi must keep the field terminator before a computed method while removing the later safe field terminator, preserving both initializers and the method.
// @evidence contracts/testing.md#independent-expectations The independently authored exact output preserves the semicolon separating a=1 from the computed name; removing it would change the initializer parse while b=2 at the end is safe.
// @evidence contracts/testing.md#distinguishing-cases The hazardous first field and safe last field form a changed/unchanged pair within one class, complementing the ordinary two-field removal positive.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiKeepsClassFieldSemiBeforeComputedMember is a selected public Go unit under TestSelectedLintUnits. The shared syntax-only fixture harness calls the owning semicolon rule and applies edits for the complete literal output assertion in the same Go process without a consumer install, native product build or product host.
func TestFormatSemiKeepsClassFieldSemiBeforeComputedMember(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/semi",
    "class F {\n  a = 1;\n  [\"x\"]() {}\n  b = 2;\n}\n",
    `{"prefer":"never"}`,
    "class F {\n  a = 1;\n  [\"x\"]() {}\n  b = 2\n}\n",
  )
}
