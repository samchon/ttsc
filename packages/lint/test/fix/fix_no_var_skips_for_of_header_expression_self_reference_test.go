package linthost

import "testing"

// TestFixNoVarSkipsForOfHeaderExpressionSelfReference verifies no-var
// reports but does not rewrite `for (var chain of [chain])`.
//
// The `for...of` head expression evaluates BEFORE the first assignment to
// the loop variable: with `var` it reads the hoisted binding's `undefined`,
// but a header `let` is still in its temporal dead zone there, so the same
// read becomes a runtime ReferenceError. The head-expression TDZ range must
// decline the fix while the diagnostic still fires (issue #409).
//
// 1. Parse a `for...of` header declaring `var chain` iterating `[chain]`.
// 2. Run the no-var fixer through the disk-backed applier.
// 3. Assert at least one finding fired but zero fixes were applied.
func TestFixNoVarSkipsForOfHeaderExpressionSelfReference(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "for (var chain of [chain]) {\n  JSON.stringify(chain);\n}\n",
  )
}
