package linthost

import "testing"

// TestFixNoVarSkipsForOfDestructuringHeader verifies no-var reports but does
// not rewrite a destructuring `for (var [a, b] of …)` header.
//
// The fix gate requires a single plain identifier declarator so the keyword
// rewrite has a simple `let x` rename target; a destructuring header binds
// several leaves whose safety the AST-local gate does not model, so it must
// stay a fixless diagnostic rather than gamble on the rewrite (issue #409).
//
// 1. Parse a `for...of` header destructuring `var [a, b]`.
// 2. Run the no-var fixer through the disk-backed applier.
// 3. Assert at least one finding fired but zero fixes were applied.
//
// @evidence contracts/testing.md#behavioral-verification no-var reports but does not rewrite the destructured [a, b] for-of header.
// @evidence contracts/testing.md#independent-expectations Original source identity and zero edits preserve the shared keyword and both leaves; the contract declines unmodeled destructured headers.
// @evidence contracts/testing.md#distinguishing-cases Multiple bound leaves contrast with the safe plain-identifier for-of arm.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarSkipsForOfDestructuringHeader invokes assertNoFixSnapshot on the [a,b] loop in process.
func TestFixNoVarSkipsForOfDestructuringHeader(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "for (var [a, b] of [[1, 2]]) {\n  JSON.stringify(a + b);\n}\n",
  )
}
