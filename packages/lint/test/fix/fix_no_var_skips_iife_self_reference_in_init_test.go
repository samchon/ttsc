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
//
// The original script is retained. A sloppy-function counterpart runs the
// same body so global-object binding exposure cannot mask this named guard.
//
// @evidence contracts/testing.md#behavioral-verification no-var leaves x initialized through an immediately invoked self-reading arrow unchanged.
// @evidence contracts/testing.md#independent-expectations The literal IIFE source and zero edits preserve the var hoisting read instead of a let temporal dead zone.
// @evidence contracts/testing.md#distinguishing-cases The self-read executes during initialization; the deferred arrow companion pins the same conservative gate without claiming the same hazard.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarSkipsIifeSelfReferenceInInit invokes assertNoFixSnapshot on x = (() => x)().
func TestFixNoVarSkipsIifeSelfReferenceInInit(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "var x = (() => x)();\n",
  )
  assertNoFixSnapshot(
    t,
    "no-var",
    "function noVarFixture(){\nvar x = (() => x)();\n}\n",
  )
}
