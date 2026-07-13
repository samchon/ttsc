package linthost

import "testing"

// TestFixNoVarSkipsUseBeforeForHeader verifies no-var reports but does not
// rewrite a `for (var i = …)` header whose binding is read before the loop.
//
// The hoisted `var` makes the earlier read a defined `undefined`; a header
// `let` would turn it into a TDZ ReferenceError (and the read also sits
// outside the loop span that bounds the `let`). The
// use-before-declaration gate must decline for headers exactly as it does
// for statement declarations, keeping the fixless diagnostic (issue #409).
//
// 1. Parse a read of `i` followed by a `for` header declaring `var i`.
// 2. Run the no-var fixer through the disk-backed applier.
// 3. Assert at least one finding fired but zero fixes were applied.
func TestFixNoVarSkipsUseBeforeForHeader(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "JSON.stringify(i);\nfor (var i = 0; i < 3; i += 1) {\n  JSON.stringify(i);\n}\n",
  )
}
