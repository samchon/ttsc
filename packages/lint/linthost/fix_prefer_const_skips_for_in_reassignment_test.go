package linthost

import "testing"

// TestFixPreferConstSkipsForInReassignment verifies prefer-const declines a
// `let` reassigned as the bare target of a `for…in` loop.
//
// Like the for-of case, a pre-existing `let` used as the bare identifier
// target of `for (x in …)` is reassigned on every iteration. The fix treats a
// for-in initializer that is NOT a VariableDeclarationList as a reassignment,
// so the `let` is no longer rewritten to a `const` the loop then assigns to.
//
//  1. Parse `let k = "";` then `for (k in { a: 1 }) console.log(k);`.
//  2. Run the prefer-const rule.
//  3. Assert the binding is recognized as reassigned, so the rule emits zero
//     findings and never offers the corrupting `const` rewrite.
//
// @evidence contracts/testing.md#behavioral-verification prefer-const emits no finding for k repeatedly assigned by a bare for-in target.
// @evidence contracts/testing.md#independent-expectations Literal for (k in ...) writes the existing k binding, independently requiring mutable let.
// @evidence contracts/testing.md#distinguishing-cases A bare identifier target differs from a fresh loop declaration and from initialized stable bindings.
// @evidence contracts/testing.md#execution-ownership TestFixPreferConstSkipsForInReassignment calls assertRuleSkipsSource with actual checker-backed prefer-const.
func TestFixPreferConstSkipsForInReassignment(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "prefer-const",
    "let k = \"\";\nfor (k in { a: 1 }) console.log(k);\n",
  )
}
