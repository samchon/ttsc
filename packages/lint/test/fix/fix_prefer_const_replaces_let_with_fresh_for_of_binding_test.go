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
func TestFixPreferConstReplacesLetWithFreshForOfBinding(t *testing.T) {
  assertFixSnapshot(
    t,
    "prefer-const",
    "let stable = 1;\nfor (const y of [stable]) console.log(y);\n",
    "const stable = 1;\nfor (const y of [stable]) console.log(y);\n",
  )
}
