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
//
// @evidence contracts/testing.md#behavioral-verification no-var preserves for (var chain of [chain]) despite emitting its diagnostic.
// @evidence contracts/testing.md#independent-expectations The original iterable self-read and zero applied edits preserve hoisting rather than introducing a temporal dead zone.
// @evidence contracts/testing.md#distinguishing-cases The iterable reads the same binding before assignment; ordinary non-self-referential for-of is the positive twin.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarSkipsForOfHeaderExpressionSelfReference runs assertNoFixSnapshot over chain and its iterable.
func TestFixNoVarSkipsForOfHeaderExpressionSelfReference(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "for (var chain of [chain]) {\n  JSON.stringify(chain);\n}\n",
  )
}
