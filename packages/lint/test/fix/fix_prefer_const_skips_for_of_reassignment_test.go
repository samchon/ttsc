package linthost

import "testing"

// TestFixPreferConstSkipsForOfReassignment verifies prefer-const declines a
// `let` reassigned as the bare target of a `for…of` loop.
//
// The reassignment walk counted only BinaryExpression / `++` / `--` /
// destructuring targets, so a pre-existing `let` used as the bare identifier
// target of `for (x of …)` was never marked assigned. Rewriting it to `const`
// makes the loop an assignment to a const (TS error and runtime TypeError).
// The fix treats a for-of/for-in initializer that is NOT a
// VariableDeclarationList as a reassignment of its target names.
//
//  1. Parse `let x = 0;` then `for (x of [1, 2, 3]) console.log(x);`.
//  2. Run the prefer-const rule.
//  3. Assert the binding is recognized as reassigned, so the rule emits zero
//     findings and never offers the corrupting `const` rewrite.
func TestFixPreferConstSkipsForOfReassignment(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "prefer-const",
    "let x = 0;\nfor (x of [1, 2, 3]) console.log(x);\n",
  )
}
