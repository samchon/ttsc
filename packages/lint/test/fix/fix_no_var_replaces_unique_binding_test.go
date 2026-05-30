package linthost

import "testing"

// TestFixNoVarReplacesUniqueBinding verifies no-var rewrites a lone `var` whose
// name is the only binding of that name in the file and is never referenced
// before its declaration.
//
// This pins the SAFE side of the redesigned single-binding gate: with exactly
// one binding position for `x` and no forward value reference, both
// preconditions hold, so the keyword rewrite to `let` proceeds.
//
//  1. Parse `var x = 1;` as the only declaration of `x`.
//  2. Apply the no-var finding's text edit through the disk-backed fixer.
//  3. Assert only the `var` keyword changed to `let`.
func TestFixNoVarReplacesUniqueBinding(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-var",
    "var x = 1;\nJSON.stringify(x);\n",
    "let x = 1;\nJSON.stringify(x);\n",
  )
}
