package linthost

import "testing"

// TestFixPreferConstReplacesLetWithFreshForOfBinding verifies prefer-const
// still rewrites a never-reassigned `let` when a nearby `for…of` declares its
// own fresh binding.
//
// The for-of/for-in reassignment branch must fire only when the initializer is
// a bare target, not when it is a VariableDeclarationList that declares a fresh
// loop binding (`for (const y of …)`). This pins that the new branch does not
// over-mark unrelated names as assigned and the safe rewrite still proceeds.
//
//  1. Parse a const-eligible `let stable = 1;` next to `for (const y of [stable])`.
//  2. Apply the prefer-const finding's text edit through the disk-backed fixer.
//  3. Assert the `let` binding becomes `const` and the loop is untouched.
//
// @evidence contracts/testing.md#behavioral-verification prefer-const fixes stable beside a for-of loop declaring a fresh const y.
// @evidence contracts/testing.md#independent-expectations Literal const stable output preserves the independent loop declaration and use.
// @evidence contracts/testing.md#distinguishing-cases A fresh loop binding must not be mistaken for a bare assignment target; bare for-of reassignment is the negative twin.
// @evidence contracts/testing.md#execution-ownership TestFixPreferConstReplacesLetWithFreshForOfBinding calls assertFixSnapshot through the real Program/checker.
func TestFixPreferConstReplacesLetWithFreshForOfBinding(t *testing.T) {
  assertFixSnapshot(
    t,
    "prefer-const",
    "let stable = 1;\nfor (const y of [stable]) console.log(y);\n",
    "const stable = 1;\nfor (const y of [stable]) console.log(y);\n",
  )
}
