package linthost

import "testing"

// TestFormatPrintWidthBreaksArrayRestAssignmentTargetWithoutComma verifies
// the reflow breaks an overflowing array destructuring assignment target
// ending in a rest (`[a, ...rest] = arr`) WITHOUT appending a trailing comma.
//
// Arrays have no objectWrap:"preserve", so the suppression must be exercised
// through a genuine width-driven break: the flat form overflows printWidth,
// the reflow explodes it one element per line, and the printer's AddComma
// would otherwise put a comma after the AssignmentRestElement (a syntax
// error). The rest-target guard keeps the exploded shape valid.
//
// 1. Configure printWidth=20 and feed a single-line array rest target that overflows.
// 2. Run formatPrintWidth so the array breaks one element per line.
// 3. Assert the broken output has no trailing comma after the rest element.
func TestFormatPrintWidthBreaksArrayRestAssignmentTargetWithoutComma(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "[alpha, ...restItems] = sourceArray;\n",
    `{"printWidth": 20}`,
    "[\n  alpha,\n  ...restItems\n] = sourceArray;\n",
  )
}
