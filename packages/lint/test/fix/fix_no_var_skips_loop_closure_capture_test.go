package linthost

import "testing"

// TestFixNoVarSkipsLoopClosureCapture verifies no-var reports but does not
// rewrite a loop-local `var` captured by a closure created inside the loop.
//
// Under `var` every iteration's closure shares ONE binding (all see the final
// value); under `let` each iteration captures a FRESH binding. The keyword
// rewrite would silently change runtime results with no diagnostic, so the
// gate declines when the declaration is loop-local and any reference sits
// behind a function boundary nested within that loop (issue #364, mirroring
// ESLint no-var's isReferencedInClosure loop check).
//
//  1. Parse a for-of body declaring `var last` and pushing `() => last`.
//  2. Run the no-var fixer through the disk-backed applier.
//  3. Assert at least one finding fired but zero fixes were applied.
func TestFixNoVarSkipsLoopClosureCapture(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "const fns = [];\nfor (const k of [1, 2]) {\n  var last = k;\n  fns.push(() => last);\n}\nJSON.stringify(fns.length);\n",
  )
}
