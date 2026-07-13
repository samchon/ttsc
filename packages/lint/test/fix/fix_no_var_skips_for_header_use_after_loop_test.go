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
func TestFixNoVarSkipsForHeaderUseAfterLoop(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "for (var i = 0; i < 3; i += 1) {\n  JSON.stringify(i);\n}\nJSON.stringify(i);\n",
  )
}
