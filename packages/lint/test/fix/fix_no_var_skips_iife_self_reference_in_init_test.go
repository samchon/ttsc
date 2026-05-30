package linthost

import "testing"

// TestFixNoVarSkipsIifeSelfReferenceInInit verifies no-var reports but does not
// rewrite a binding that reads itself through an immediately-invoked arrow in
// its OWN initializer.
//
// `var x = (() => x)();` is legal under `var` hoisting: the arrow is invoked
// during initialization and reads the hoisted `undefined`. Rewriting the
// keyword to `let` turns that executes-during-init self-read into a TDZ
// ReferenceError. The conservative TDZ gate declines on ANY value reference to
// the target within the declarator's initializer range (it does not try to
// distinguish a closure invoked now from one deferred), so the diagnostic fires
// but the source keeps its `var`.
//
//  1. Parse `var x = (() => x)();`, a self-read via an IIFE in the initializer.
//  2. Run the no-var fixer through the disk-backed applier.
//  3. Assert at least one finding fired but zero fixes were applied.
func TestFixNoVarSkipsIifeSelfReferenceInInit(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "var x = (() => x)();\n",
  )
}
