package linthost

import "testing"

// TestFixNoVarSkipsForOfHeaderClosureCapture verifies no-var reports but
// does not rewrite a `for (var item of …)` header captured by a closure
// created inside the loop.
//
// Negative twin of the safe `for...of`-header rewrite: the loop protocol
// assigns every element to the SAME `var` binding, so closures made inside
// the loop all read the last element; a `let` header gives each closure its
// own per-iteration binding. The rewrite would change runtime results, so
// the gate must decline while the diagnostic still fires (issue #409).
//
//  1. Parse a `for...of` header declaring `var item` whose body pushes
//     `() => item`.
//  2. Run the no-var fixer through the disk-backed applier.
//  3. Assert at least one finding fired but zero fixes were applied.
func TestFixNoVarSkipsForOfHeaderClosureCapture(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "const fns = [];\nfor (var item of [1, 2]) {\n  fns.push(() => item);\n}\nJSON.stringify(fns.length);\n",
  )
}
