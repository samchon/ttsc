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
//
// @evidence contracts/testing.md#behavioral-verification no-var refuses a for-header i rewrite after an earlier i read.
// @evidence contracts/testing.md#independent-expectations The authored pre-loop read and zero edits preserve var hoisting and loop visibility.
// @evidence contracts/testing.md#distinguishing-cases A before-loop reference differs from the safe header with only body references; after-loop scope escape has a separate case.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarSkipsUseBeforeForHeader calls assertNoFixSnapshot on the i-before-loop source.
func TestFixNoVarSkipsUseBeforeForHeader(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "JSON.stringify(i);\nfor (var i = 0; i < 3; i += 1) {\n  JSON.stringify(i);\n}\n",
  )
}
