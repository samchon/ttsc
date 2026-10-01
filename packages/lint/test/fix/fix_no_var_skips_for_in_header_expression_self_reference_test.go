package linthost

import "testing"

// TestFixNoVarSkipsForInHeaderExpressionSelfReference verifies no-var
// reports but does not rewrite `for (var looped in looped)`.
//
// The `for...in` head expression evaluates before the first key assignment:
// with `var` it enumerates the hoisted binding's `undefined` (zero
// iterations, no throw), but a header `let` is still in its temporal dead
// zone there, so the same read becomes a runtime ReferenceError. The
// head-expression TDZ range must decline the fix while the diagnostic still
// fires (issue #409).
//
// 1. Parse a `for...in` header declaring `var looped` enumerating `looped`.
// 2. Run the no-var fixer through the disk-backed applier.
// 3. Assert at least one finding fired but zero fixes were applied.
//
// The original script is retained. A sloppy-function counterpart runs the
// same body so global-object binding exposure cannot mask this named guard.
//
// @evidence contracts/testing.md#behavioral-verification no-var leaves the self-referential for-in header looped in looped unchanged while reporting it.
// @evidence contracts/testing.md#independent-expectations The literal original source and zero edits preserve the hoisted head-expression read rather than causing a let temporal dead zone.
// @evidence contracts/testing.md#distinguishing-cases Head-expression self-reference differs from the ordinary non-self-referential for-in fix.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarSkipsForInHeaderExpressionSelfReference calls assertNoFixSnapshot for the looped-in-looped fixture.
func TestFixNoVarSkipsForInHeaderExpressionSelfReference(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "for (var looped in looped) {\n  JSON.stringify(looped);\n}\n",
  )
  assertNoFixSnapshot(
    t,
    "no-var",
    "function noVarFixture(){\nfor (var looped in looped) {\n  JSON.stringify(looped);\n}\n}\n",
  )
}
