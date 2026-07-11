package linthost

import "testing"

// TestFixNoVarSkipsWhileLoopClosureCapture verifies no-var declines the fix
// for a `var` inside a while-loop body captured by a nested arrow.
//
// The loop-closure decline must cover every loop statement kind, not only the
// for-family: a while-loop body also re-creates closures per iteration, so
// `var`→`let` changes which binding those closures share. This pins the
// while/do arm of the enclosing-loop classifier alongside the for-of case.
//
//  1. Parse a while body declaring `var x` and pushing `() => x`.
//  2. Run the no-var fixer through the disk-backed applier.
//  3. Assert at least one finding fired but zero fixes were applied.
func TestFixNoVarSkipsWhileLoopClosureCapture(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "const fns = [];\nwhile (Math.random() > 0.5) {\n  var x = 1;\n  fns.push(() => x);\n}\nJSON.stringify(fns.length);\n",
  )
}
