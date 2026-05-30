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
func TestFixNoVarSkipsDirectSelfReferenceInInit(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "var x = x;\n",
  )
}
