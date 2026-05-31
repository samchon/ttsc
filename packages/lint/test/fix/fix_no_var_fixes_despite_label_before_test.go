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
func TestFixNoVarFixesDespiteLabelBefore(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-var",
    "x: for (let i = 0; i < 1; i++) break x;\nvar x = 1;\nJSON.stringify(x);\n",
    "x: for (let i = 0; i < 1; i++) break x;\nlet x = 1;\nJSON.stringify(x);\n",
  )
}
