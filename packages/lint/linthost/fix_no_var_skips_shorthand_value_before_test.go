package linthost

import "testing"

// TestFixNoVarSkipsShorthandValueBefore verifies no-var reports but does not
// rewrite a binding read by an object-literal shorthand before its declaration.
//
// An object-literal shorthand `({ x })` is a value READ of binding `x`, unlike
// a property key. Under `var` hoisting the earlier `({ x })` reads `undefined`;
// rewriting the keyword to `let` turns that into a TDZ ReferenceError. The
// safety gate must classify the shorthand name as a value reference so the
// forward read forces a decline: the diagnostic fires but the source
// keeps its `var`.
//
//  1. Parse `({ x });` (object-literal shorthand) before `var x = 1;`.
//  2. Run the no-var fixer through the disk-backed applier.
//  3. Assert at least one finding fired but zero fixes were applied.
//
// The original script is retained. A sloppy-function counterpart runs the
// same body so global-object binding exposure cannot mask this named guard.
//
// @evidence contracts/testing.md#behavioral-verification no-var declines the x rewrite after an earlier object shorthand reads x.
// @evidence contracts/testing.md#independent-expectations Literal ({ x }) is a value read; source identity and zero edits preserve its hoisted undefined behavior.
// @evidence contracts/testing.md#distinguishing-cases The shorthand differs from the non-reading property key in TestFixNoVarFixesDespiteObjectKeyBefore.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarSkipsShorthandValueBefore runs assertNoFixSnapshot on the shorthand-before-var source.
func TestFixNoVarSkipsShorthandValueBefore(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "({ x });\nvar x = 1;\nJSON.stringify(x);\n",
  )
  assertNoFixSnapshot(
    t,
    "no-var",
    "function noVarFixture(){\n({ x });\nvar x = 1;\nJSON.stringify(x);\n}\n",
  )
}
