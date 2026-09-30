package linthost

import "testing"

// TestFixNoVarSkipsForHeaderUseAfterLoop verifies no-var reports but does
// not rewrite a `for (var i = …)` header whose binding is read after the
// loop.
//
// A header `var` hoists to the enclosing function/global scope, so
// `JSON.stringify(i)` after the loop reads the final counter; a header
// `let` scopes to the loop statement and the same read stops compiling.
// The scope-containment gate must treat the loop's own span as the `let`
// boundary and decline, keeping the fixless diagnostic (issue #409).
//
// 1. Parse a `for` header declaring `var i`, then read `i` after the loop.
// 2. Run the no-var fixer through the disk-backed applier.
// 3. Assert at least one finding fired but zero fixes were applied.
//
// @evidence contracts/testing.md#behavioral-verification no-var declines the i header rewrite when a post-loop read still needs var visibility.
// @evidence contracts/testing.md#independent-expectations Literal original loop plus trailing JSON.stringify(i) and zero edits specify the scope boundary independently.
// @evidence contracts/testing.md#distinguishing-cases The read crosses the loop span, unlike the safe header case with only in-loop reads.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarSkipsForHeaderUseAfterLoop calls assertNoFixSnapshot on the complete loop-and-after-read fixture.
func TestFixNoVarSkipsForHeaderUseAfterLoop(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "for (var i = 0; i < 3; i += 1) {\n  JSON.stringify(i);\n}\nJSON.stringify(i);\n",
  )
}
