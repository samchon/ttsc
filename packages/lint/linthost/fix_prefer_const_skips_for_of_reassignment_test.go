package linthost

import "testing"

// TestFixPreferConstSkipsForOfReassignment verifies prefer-const declines a
// `let` reassigned as the bare target of a `for…of` loop.
//
// A pre-existing `let` used as the bare identifier in `for (x of …)` is an
// assignment target rather than a fresh loop declaration. Rewriting it to
// const would make the loop write an immutable binding. The native rule
// records non-declaration loop targets by checker symbol; this test requires
// zero findings without running rewritten JavaScript or compiler diagnostics.
//
//  1. Parse `let x = 0;` then `for (x of [1, 2, 3]) console.log(x);`.
//  2. Run the prefer-const rule.
//  3. Assert the binding is recognized as reassigned, so the rule emits zero
//     findings and never offers the corrupting `const` rewrite.
//
// @evidence contracts/testing.md#behavioral-verification prefer-const emits no finding for x assigned by a bare for-of target.
// @evidence contracts/testing.md#independent-expectations The independent iterable/target fixture requires mutable x; zero findings reject the corrupting const rewrite.
// @evidence contracts/testing.md#distinguishing-cases Bare target assignment differs from a freshly declared loop binding in the companion positive test.
// @evidence contracts/testing.md#execution-ownership TestFixPreferConstSkipsForOfReassignment runs assertRuleSkipsSource through the real Program/checker.
func TestFixPreferConstSkipsForOfReassignment(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "prefer-const",
    "let x = 0;\nfor (x of [1, 2, 3]) console.log(x);\n",
  )
}
