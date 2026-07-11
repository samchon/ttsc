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
func TestFixNoVarSkipsWithStatementBody(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "const o = { x: 0 };\nwith (o) {\n  var x = 1;\n  JSON.stringify(x);\n}\n",
  )
}
