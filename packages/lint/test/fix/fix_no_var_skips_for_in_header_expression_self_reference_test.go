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
func TestFixNoVarSkipsForInHeaderExpressionSelfReference(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "for (var looped in looped) {\n  JSON.stringify(looped);\n}\n",
  )
}
