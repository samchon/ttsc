package linthost

import "testing"

// TestFixNoVarReplacesClosureReferenceWithoutLoop verifies no-var still
// rewrites a top-level `var` that a nested arrow closes over.
//
// Negative twin of the loop-closure decline: this initialized module binding
// is captured only after its declaration, with no repeated loop entry or
// direct eval. Both forms provide one binding to the later closure, so the
// loop-capture check must not blanket-decline this otherwise safe case.
//
//  1. Parse a top-level `var x` read from inside an arrow function.
//  2. Apply the no-var finding's text edit through the disk-backed fixer.
//  3. Assert only the `var` keyword changed to `let`.
//
// An explicit module owns the binding; var does not create a global-object property.
//
// @evidence contracts/testing.md#behavioral-verification no-var fixes top-level x captured by a later arrow while leaving the closure unchanged.
// @evidence contracts/testing.md#independent-expectations The literal let x output preserves g and its invocation; the non-loop binding remains one shared binding.
// @evidence contracts/testing.md#distinguishing-cases Capture outside a loop is safe, contrasting with per-iteration closure captures in the loop refusal cases.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarReplacesClosureReferenceWithoutLoop applies no-var through assertFixSnapshot to its x/g fixture.
func TestFixNoVarReplacesClosureReferenceWithoutLoop(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-var",
    "var x = 1;\nconst g = () => JSON.stringify(x);\ng();\nexport {};\n",
    "let x = 1;\nconst g = () => JSON.stringify(x);\ng();\nexport {};\n",
  )
}
