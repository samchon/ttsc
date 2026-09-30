package linthost

import "testing"

// TestFixNoVarReplacesNamespaceBlockBinding verifies no-var still rewrites a
// `var` declared directly inside a namespace body.
//
// A ModuleBlock is a legal lexical-declaration position and the binding's
// block scope, so a namespace-local `var` with namespace-local references
// must keep its autofix. Pins the ModuleBlock arm of the
// block-scope-container classifier introduced for issue #364.
//
//  1. Parse a namespace declaring `var x` and reading it inside the body.
//  2. Apply the no-var finding's text edit through the disk-backed fixer.
//  3. Assert only the `var` keyword changed to `let`.
//
// @evidence contracts/testing.md#behavioral-verification no-var rewrites namespace-local x while retaining the namespace body and local use.
// @evidence contracts/testing.md#independent-expectations The literal namespace/let result identifies a legal lexical declaration slot and preserves all non-keyword bytes.
// @evidence contracts/testing.md#distinguishing-cases ModuleBlock is a permitted scope container; unbraced statement bodies are rejected separately.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarReplacesNamespaceBlockBinding calls assertFixSnapshot with its namespace N fixture.
func TestFixNoVarReplacesNamespaceBlockBinding(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-var",
    "namespace N {\n  var x = 1;\n  JSON.stringify(x);\n}\n",
    "namespace N {\n  let x = 1;\n  JSON.stringify(x);\n}\n",
  )
}
