package linthost

import "testing"

// TestFixNoVarSkipsShorthandValueBefore verifies no-var reports but does not
// rewrite a binding read by an object-literal shorthand before its declaration.
//
// An object-literal shorthand `({ x })` is a value READ of binding `x`, unlike
// a property key. Under `var` hoisting the earlier `({ x })` reads `undefined`;
// rewriting the keyword to `let` turns that into a TDZ ReferenceError. The
// safety gate must classify the shorthand name as a value reference so the
// forward read forces an over-decline: the diagnostic fires but the source
// keeps its `var`.
//
//  1. Parse `({ x });` (object-literal shorthand) before `var x = 1;`.
//  2. Run the no-var fixer through the disk-backed applier.
//  3. Assert at least one finding fired but zero fixes were applied.
func TestFixNoVarSkipsShorthandValueBefore(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "({ x });\nvar x = 1;\nJSON.stringify(x);\n",
  )
}
