package linthost

import "testing"

// TestFixNoVarSkipsWithStatementBody verifies no-var declines the fix for a
// `var` declared inside a `with` statement body.
//
// `var` hoists past the with body to the function scope, so a same-name
// property on the with target intercepts every reference inside the body;
// `let` would live inside the body's block and shadow the with object
// instead. When the target object has that property the rewrite flips which
// binding each reference hits, so the gate declines any var declared under a
// `with` (issue #364 follow-through: same corruption class as the scope
// checks).
//
//  1. Parse a with body declaring `var x` and reading it in the body.
//  2. Run the no-var fixer through the disk-backed applier.
//  3. Assert at least one finding fired but zero fixes were applied.
//
// @evidence contracts/testing.md#behavioral-verification no-var leaves x declared under with unchanged while reporting it.
// @evidence contracts/testing.md#independent-expectations Literal with(o), o.x and var x plus zero edits preserve dynamic object interception instead of introducing an inner lexical shadow.
// @evidence contracts/testing.md#distinguishing-cases Declaration-inside-with differs from an outside declaration merely read by a with body.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarSkipsWithStatementBody runs assertNoFixSnapshot on the dynamic-scope fixture.
func TestFixNoVarSkipsWithStatementBody(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "const o = { x: 0 };\nwith (o) {\n  var x = 1;\n  JSON.stringify(x);\n}\n",
  )
}
