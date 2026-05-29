package linthost

import "testing"

// TestFormatPrintWidthIndentsNestedAlternateTernary verifies an
// overflowing ternary chain breaks into Prettier 3's staircase, with the
// nested conditional in the alternate position indented one level deeper.
//
// `a ? b : c ? d : e` is a chain whose alternate is itself a conditional.
// Prettier 3 ("indent nested ternaries") breaks the whole chain together
// and steps the inner rungs in by tabWidth; the old verbatim fallback
// left the source flat or mis-aligned (Prettier 2 style).
//
//  1. Parse an over-width single-line ternary chain (printWidth 40).
//  2. Apply format/print-width.
//  3. Assert the staircase: outer rungs at indent 2, inner at indent 4.
func TestFormatPrintWidthIndentsNestedAlternateTernary(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "const x = aaaaaaaaaa ? bbbbbbbbbb : cccccccccc ? dddddddddd : eeeeeeeeee;\n",
    `{"printWidth":40,"tabWidth":2}`,
    "const x = aaaaaaaaaa\n  ? bbbbbbbbbb\n  : cccccccccc\n    ? dddddddddd\n    : eeeeeeeeee;\n",
  )
}
