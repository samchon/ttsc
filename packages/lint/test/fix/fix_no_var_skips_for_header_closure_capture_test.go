package linthost

import "testing"

// TestFixNoVarSkipsForHeaderClosureCapture verifies no-var reports but does
// not rewrite a `for (var i = …)` header captured by a closure created
// inside the loop.
//
// Negative twin of the safe `for`-header rewrite: under `var` every
// iteration's closure shares ONE binding (all read the final value 2);
// under `let` each iteration captures a FRESH binding (0, then 1). The
// classic setTimeout-in-a-loop shape — the keyword rewrite would silently
// change runtime results, so the gate must decline while the diagnostic
// still fires (issue #409).
//
// 1. Parse a `for` header declaring `var i` whose body pushes `() => i`.
// 2. Run the no-var fixer through the disk-backed applier.
// 3. Assert at least one finding fired but zero fixes were applied.
func TestFixNoVarSkipsForHeaderClosureCapture(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "const fns = [];\nfor (var i = 0; i < 2; i += 1) {\n  fns.push(() => i);\n}\nJSON.stringify(fns.length);\n",
  )
}
