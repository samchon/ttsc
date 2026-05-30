package linthost

import "testing"

// TestFixNoVarReplacesReassignedBinding verifies no-var rewrites a single-
// binding `var` even when the binding is later reassigned.
//
// A reassignment (`count = count + 1`) is a value write, not a new binding, so
// it leaves the single-binding-in-file count at one. `let` permits
// reassignment, so the rewrite is safe and must still apply; this guards
// against a future regression that miscounts assignment targets as bindings.
//
//  1. Parse `var count = 0; count = count + 1;`.
//  2. Apply the no-var finding's text edit through the disk-backed fixer.
//  3. Assert only the `var` keyword changed to `let`.
func TestFixNoVarReplacesReassignedBinding(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-var",
    "var count = 0;\ncount = count + 1;\nJSON.stringify(count);\n",
    "let count = 0;\ncount = count + 1;\nJSON.stringify(count);\n",
  )
}
