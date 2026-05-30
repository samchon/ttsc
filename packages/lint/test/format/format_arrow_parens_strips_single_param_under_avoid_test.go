package linthost

import "testing"

// TestFormatArrowParensStripsSingleParamUnderAvoid verifies prefer:"avoid"
// removes the parentheses around a single bare-identifier arrow parameter.
//
//  1. Parse `(x) => x`.
//  2. Apply format/arrow-parens with prefer:"avoid".
//  3. Assert it becomes `x => x`.
func TestFormatArrowParensStripsSingleParamUnderAvoid(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/arrow-parens",
    "const a = (x) => x;\n",
    `{"prefer":"avoid"}`,
    "const a = x => x;\n",
  )
}
