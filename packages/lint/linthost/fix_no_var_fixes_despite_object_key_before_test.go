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
//  1. Parse `JSON.stringify({ x: 1 });` (object key) before `var x = 2;`.
//  2. Apply the no-var finding's text edit through the disk-backed fixer.
//  3. Assert only the `var` keyword changed to `let`.
//
// An explicit module owns the binding; var does not create a global-object property.
//
// @evidence contracts/testing.md#behavioral-verification no-var fixes var x after an object key named x.
// @evidence contracts/testing.md#independent-expectations Literal let x output preserves the earlier { x: 1 } property and trailing read; the property key binds no variable.
// @evidence contracts/testing.md#distinguishing-cases A property key differs from the shorthand value read protected by TestFixNoVarSkipsShorthandValueBefore.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarFixesDespiteObjectKeyBefore exercises no-var through assertFixSnapshot over the authored object-key fixture.
func TestFixNoVarFixesDespiteObjectKeyBefore(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-var",
    "JSON.stringify({ x: 1 });\nvar x = 2;\nJSON.stringify(x);\nexport {};\n",
    "JSON.stringify({ x: 1 });\nlet x = 2;\nJSON.stringify(x);\nexport {};\n",
  )
}
