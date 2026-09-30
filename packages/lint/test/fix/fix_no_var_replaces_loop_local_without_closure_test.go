package linthost

import "testing"

// TestFixNoVarReplacesLoopLocalWithoutClosure verifies no-var still rewrites
// a loop-local `var` whose references never cross a function boundary.
//
// Second negative twin of the loop-closure decline: a plain read in the same
// iteration observes the identical value under `var` and `let`; only a
// closure created inside the loop can tell the bindings apart. The
// loop-local + direct-reference shape must keep its autofix.
//
//  1. Parse a for-of body declaring `var x` and reading it directly.
//  2. Apply the no-var finding's text edit through the disk-backed fixer.
//  3. Assert only the `var` keyword changed to `let`.
//
// @evidence contracts/testing.md#behavioral-verification no-var fixes loop-body x when all reads are direct within that iteration.
// @evidence contracts/testing.md#independent-expectations The literal expected let x keeps the surrounding const-k loop and JSON.stringify call unchanged.
// @evidence contracts/testing.md#distinguishing-cases Loop-locality alone must not decline: a capture across a function boundary, present in TestFixNoVarSkipsLoopClosureCapture, is the distinguishing hazard.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarReplacesLoopLocalWithoutClosure applies actual no-var findings with assertFixSnapshot in process.
func TestFixNoVarReplacesLoopLocalWithoutClosure(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-var",
    "for (const k of [1, 2]) {\n  var x = k;\n  JSON.stringify(x);\n}\n",
    "for (const k of [1, 2]) {\n  let x = k;\n  JSON.stringify(x);\n}\n",
  )
}
