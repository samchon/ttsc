package linthost

import "testing"

// TestFixNoVarFixesDespiteObjectKeyBefore verifies no-var still rewrites a
// `var` whose name also appears as an object-literal key above it.
//
// An object-literal property key (`{ x: 1 }`) is a member name, not a value
// reference, so it must not be read as a forward reference that forces an
// over-decline. The AST role check excludes property-assignment keys, leaving
// the safe rewrite to `let` intact.
//
//  1. Parse `({ x: 1 });` (object key) before `var x = 2;`.
//  2. Apply the no-var finding's text edit through the disk-backed fixer.
//  3. Assert only the `var` keyword changed to `let`.
func TestFixNoVarFixesDespiteObjectKeyBefore(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-var",
    "JSON.stringify({ x: 1 });\nvar x = 2;\nJSON.stringify(x);\n",
    "JSON.stringify({ x: 1 });\nlet x = 2;\nJSON.stringify(x);\n",
  )
}
