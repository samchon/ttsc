package linthost

import "testing"

// TestFixNoVarFixesDespiteLabelBefore verifies no-var still rewrites a `var`
// whose name also appears as a statement label above it.
//
// A statement label (`x:`) lives in a separate namespace from values, so it
// must not be read as a forward value reference that forces an over-decline.
// The AST role check excludes labeled-statement and break/continue labels,
// leaving the safe rewrite to `let` intact.
//
//  1. Parse a labeled loop `x: for (…) break x;` before `var x = 1;`.
//  2. Apply the no-var finding's text edit through the disk-backed fixer.
//  3. Assert only the `var` keyword changed to `let`.
//
// An explicit module owns the binding; var does not create a global-object property.
//
// @evidence contracts/testing.md#behavioral-verification no-var replaces var x even after the x statement/break label.
// @evidence contracts/testing.md#independent-expectations Literal let x output preserves both labels because labels occupy a namespace separate from values.
// @evidence contracts/testing.md#distinguishing-cases The x label is not a forward value read; the actual shorthand/ordinary forward-read refusal cases supply the opposite boundary.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarFixesDespiteLabelBefore runs assertFixSnapshot on the labeled-loop source with no-var and the actual disk applier.
func TestFixNoVarFixesDespiteLabelBefore(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-var",
    "x: for (let i = 0; i < 1; i++) break x;\nvar x = 1;\nJSON.stringify(x);\nexport {};\n",
    "x: for (let i = 0; i < 1; i++) break x;\nlet x = 1;\nJSON.stringify(x);\nexport {};\n",
  )
}
