package linthost

import "testing"

// TestFormatArrowParensStripsWrappedParamBeforeListComma verifies
// prefer:"avoid" still strips `(x) => x` when the arrow is an array element
// followed by a comma and a comment: `[(x) => x, /* c */ 1]` becomes
// `[x => x, /* c */ 1]`.
//
// Negative twin for the trailing-comma tolerance in
// `arrowParamRegionHasComment`: a comma is only skipped *before* the closing
// paren (a parameter-list trailing comma). A comma after the `)` belongs to
// the enclosing list, so a comment beyond it is not a parameter comment and
// must not make the rule abstain.
//
//  1. Parse `const a = [(x) => x, /* c */ 1];`.
//  2. Apply format/arrow-parens with prefer:"avoid".
//  3. Assert only the arrow changes: `const a = [x => x, /* c */ 1];`.
func TestFormatArrowParensStripsWrappedParamBeforeListComma(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/arrow-parens",
    "const a = [(x) => x, /* c */ 1];\n",
    `{"prefer":"avoid"}`,
    "const a = [x => x, /* c */ 1];\n",
  )
}
