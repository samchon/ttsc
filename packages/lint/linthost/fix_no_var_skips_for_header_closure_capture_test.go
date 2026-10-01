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
//
// The original script is retained. A sloppy-function counterpart runs the
// same body so global-object binding exposure cannot mask this named guard.
//
// @evidence contracts/testing.md#behavioral-verification no-var refuses the for-header i rewrite when iteration-created arrows capture i.
// @evidence contracts/testing.md#independent-expectations The original fns loop and zero edits retain one shared var binding; no output is generated from the candidate fixer.
// @evidence contracts/testing.md#distinguishing-cases Closure capture contrasts with the direct-read safe for-header test.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarSkipsForHeaderClosureCapture calls assertNoFixSnapshot for the fns-push loop.
func TestFixNoVarSkipsForHeaderClosureCapture(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "const fns = [];\nfor (var i = 0; i < 2; i += 1) {\n  fns.push(() => i);\n}\nJSON.stringify(fns.length);\n",
  )
  assertNoFixSnapshot(
    t,
    "no-var",
    "function noVarFixture(){\nconst fns = [];\nfor (var i = 0; i < 2; i += 1) {\n  fns.push(() => i);\n}\nJSON.stringify(fns.length);\n}\n",
  )
}
