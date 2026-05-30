package linthost

import "testing"

// TestFormatArrowParensWrapsBareSingleParam verifies prefer:"always" (the
// default, matching Prettier) adds parentheses around a single bare-identifier
// arrow parameter.
//
//  1. Parse `x => x`.
//  2. Apply format/arrow-parens with prefer:"always".
//  3. Assert it becomes `(x) => x`.
func TestFormatArrowParensWrapsBareSingleParam(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/arrow-parens",
    "const a = x => x;\n",
    `{"prefer":"always"}`,
    "const a = (x) => x;\n",
  )
}
