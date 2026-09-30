package linthost

import "testing"

// TestFixNoVarSkipsTypeofSelfReferenceInInit verifies no-var reports but does
// not rewrite a binding that reads itself inside its OWN initializer.
//
// `var x = typeof x;` is legal under `var` hoisting: the initializer reads the
// hoisted `undefined` and yields "undefined". Rewriting the keyword to `let`
// turns that self-read into a TDZ ReferenceError, because the binding is not
// yet initialized when its initializer runs. The earlier TDZ gate only flagged
// references whose Pos() preceded the var statement's start, so a self-read
// inside the initializer (Pos() after the statement start) slipped through. The
// gate now also declines when the target is value-referenced within the
// declarator's initializer range, so the diagnostic fires but the `var` stays.
//
//  1. Parse `var x = typeof x;`, a self-read inside the initializer.
//  2. Run the no-var fixer through the disk-backed applier.
//  3. Assert at least one finding fired but zero fixes were applied.
//
// @evidence contracts/testing.md#behavioral-verification no-var leaves x = typeof x unchanged while retaining its diagnostic.
// @evidence contracts/testing.md#independent-expectations The authored initializer and zero fixes preserve typeof on a hoisted var rather than a lexical temporal-dead-zone read.
// @evidence contracts/testing.md#distinguishing-cases An own-initializer reference is unsafe even though its source position follows the var token.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarSkipsTypeofSelfReferenceInInit calls assertNoFixSnapshot on the typeof-x initializer.
func TestFixNoVarSkipsTypeofSelfReferenceInInit(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "var x = typeof x;\n",
  )
}
