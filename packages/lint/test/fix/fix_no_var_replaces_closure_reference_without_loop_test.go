package linthost

import "testing"

// TestFixNoVarReplacesClosureReferenceWithoutLoop verifies no-var still
// rewrites a top-level `var` that a nested arrow closes over.
//
// Negative twin of the loop-closure decline: capture semantics only diverge
// between `var` and `let` when the declaration is re-entered per loop
// iteration. A closure over a non-loop binding sees the same single binding
// either way, so the closure check must stay scoped to loop-local
// declarations and not blanket-decline every captured name.
//
//  1. Parse a top-level `var x` read from inside an arrow function.
//  2. Apply the no-var finding's text edit through the disk-backed fixer.
//  3. Assert only the `var` keyword changed to `let`.
func TestFixNoVarReplacesClosureReferenceWithoutLoop(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-var",
    "var x = 1;\nconst g = () => JSON.stringify(x);\ng();\n",
    "let x = 1;\nconst g = () => JSON.stringify(x);\ng();\n",
  )
}
