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
//
// @evidence contracts/testing.md#behavioral-verification format/arrow-parens must strip the eligible arrow parameter wrapper without deleting the outer array comma, c comment or following numeric element.
// @evidence contracts/testing.md#independent-expectations The literal expected array preserves its two elements and sibling comment; the enclosing comma is independently outside the arrow parameter list.
// @evidence contracts/testing.md#distinguishing-cases This changed enclosing-list case contrasts with parameter-list comments that require abstention, distinguishing sibling ownership from parameter trailing-comma tolerance.
// @evidence contracts/testing.md#execution-ownership TestFormatArrowParensStripsWrappedParamBeforeListComma is a public Go unit selected by the lint semantic-unit Evidence claim. The shared syntax-only harness calls the owning arrow rule on temporary fixture source and applies reported edits for snapshots; this host owns every named case without a consumer install, native product build or product host.
func TestFormatArrowParensStripsWrappedParamBeforeListComma(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/arrow-parens",
    "const a = [(x) => x, /* c */ 1];\n",
    `{"prefer":"avoid"}`,
    "const a = [x => x, /* c */ 1];\n",
  )
}
