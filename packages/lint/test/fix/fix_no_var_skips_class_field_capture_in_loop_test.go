package linthost

import "testing"

// TestFixNoVarSkipsClassFieldCaptureInLoop verifies no-var declines the fix
// for a loop-local `var` referenced from a class field initializer inside the
// loop.
//
// An instance field initializer is deferred code: it runs at construction
// time and closes over the class definition's environment exactly like a
// method body. A class created per iteration therefore shares one `var`
// binding across all its instances but would capture a fresh per-iteration
// `let` binding, so the loop-closure decline must treat PropertyDeclaration
// as a capture boundary, not only function-like bodies.
//
//  1. Parse a for-of body declaring `var x` and pushing `class { p = x }`.
//  2. Run the no-var fixer through the disk-backed applier.
//  3. Assert at least one finding fired but zero fixes were applied.
//
// @evidence contracts/testing.md#behavioral-verification no-var diagnoses but leaves loop-local x captured by a class instance-field initializer unchanged.
// @evidence contracts/testing.md#independent-expectations The literal source and zero disk edits preserve the shared var capture rather than creating per-iteration let bindings.
// @evidence contracts/testing.md#distinguishing-cases Deferred class-field capture differs from a direct loop-local read; this is not merely the arrow-only capture arm.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarSkipsClassFieldCaptureInLoop executes assertNoFixSnapshot over its classes-push fixture.
func TestFixNoVarSkipsClassFieldCaptureInLoop(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "const classes = [];\nfor (const k of [1, 2]) {\n  var x = k;\n  classes.push(\n    class {\n      p = x;\n    },\n  );\n}\nJSON.stringify(classes.length);\n",
  )
}
