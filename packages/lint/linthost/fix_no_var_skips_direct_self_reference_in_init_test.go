package linthost

import "testing"

// TestFixNoVarSkipsDirectSelfReferenceInInit verifies no-var reports but does
// not rewrite a binding that reads itself directly in its OWN initializer.
//
// `var x = x;` is legal under `var` hoisting: the right-hand `x` reads the
// hoisted `undefined`, so `x` ends up `undefined`. Rewriting the keyword to
// `let` turns that self-read into a TDZ ReferenceError, because `x` is in its
// temporal dead zone while its own initializer evaluates. The TDZ gate now
// declines when the target is value-referenced within the declarator's
// initializer range, so the diagnostic fires but the source keeps its `var`.
//
//  1. Parse `var x = x;`, a direct self-read inside the initializer.
//  2. Run the no-var fixer through the disk-backed applier.
//  3. Assert at least one finding fired but zero fixes were applied.
//
// The original script is retained. A sloppy-function counterpart runs the
// same body so global-object binding exposure cannot mask this named guard.
//
// @evidence contracts/testing.md#behavioral-verification no-var diagnoses var x = x and leaves its self-read initializer unchanged.
// @evidence contracts/testing.md#independent-expectations Original source equality and zero edits preserve the hoisted undefined read instead of introducing a let temporal dead zone.
// @evidence contracts/testing.md#distinguishing-cases An immediate own-initializer read is the unsafe arm; the unrelated initialized unique binding fixes normally.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarSkipsDirectSelfReferenceInInit exercises assertNoFixSnapshot for no-var on x = x.
func TestFixNoVarSkipsDirectSelfReferenceInInit(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "var x = x;\n",
  )
  assertNoFixSnapshot(
    t,
    "no-var",
    "function noVarFixture(){\nvar x = x;\n}\n",
  )
}
