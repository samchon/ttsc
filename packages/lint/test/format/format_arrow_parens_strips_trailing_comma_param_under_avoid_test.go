package linthost

import "testing"

// TestFormatArrowParensStripsTrailingCommaParamUnderAvoid verifies
// prefer:"avoid" removes the parentheses *and* the legal trailing comma of a
// single bare-identifier parameter: `(x,) => x` becomes `x => x`, matching
// Prettier.
//
// Before the trailing-comma-aware wrappedness detection this input was
// silently skipped (the `,` byte aborted the forward paren scan, so the
// parameter looked bare and "avoid" had nothing to strip). The fix must delete
// the comma together with the parens — replacing only `(x)` would leave the
// invalid `x, => x`.
//
//  1. Parse a trailing-comma single-parameter arrow (plain, async, and
//     multiline variants).
//  2. Apply format/arrow-parens with prefer:"avoid".
//  3. Assert parens and comma are gone: `x => x`.
func TestFormatArrowParensStripsTrailingCommaParamUnderAvoid(t *testing.T) {
  t.Run("single_line", func(t *testing.T) {
    assertFixSnapshotWithOptions(
      t,
      "format/arrow-parens",
      "const a = (x,) => x;\n",
      `{"prefer":"avoid"}`,
      "const a = x => x;\n",
    )
  })
  t.Run("async", func(t *testing.T) {
    assertFixSnapshotWithOptions(
      t,
      "format/arrow-parens",
      "const a = async (x,) => x;\n",
      `{"prefer":"avoid"}`,
      "const a = async x => x;\n",
    )
  })
  t.Run("multiline", func(t *testing.T) {
    assertFixSnapshotWithOptions(
      t,
      "format/arrow-parens",
      "const a = (\n  x,\n) => x;\n",
      `{"prefer":"avoid"}`,
      "const a = x => x;\n",
    )
  })
}
