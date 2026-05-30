package linthost

import "testing"

// TestFormatArrowParensStripsAsyncSingleParam verifies prefer:"avoid" strips
// the parens of an async single-identifier arrow (`async (x) =>` becomes
// `async x =>`); the async modifier precedes the parameter span, so the
// rewrite touches only the parameter.
//
//  1. Parse `async (x) => x`.
//  2. Apply format/arrow-parens with prefer:"avoid".
//  3. Assert it becomes `async x => x`.
func TestFormatArrowParensStripsAsyncSingleParam(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/arrow-parens",
    "const i = async (x) => x;\n",
    `{"prefer":"avoid"}`,
    "const i = async x => x;\n",
  )
}
