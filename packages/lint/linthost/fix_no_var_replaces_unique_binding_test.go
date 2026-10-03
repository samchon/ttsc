package linthost

import "testing"

// TestFixNoVarReplacesUniqueBinding verifies no-var rewrites a lone `var` whose
// name is the only binding of that name in the file and is never referenced
// before its declaration.
//
// This pins the single-binding and forward-reference gates in an initialized
// module fixture. Its later ordinary read also stays within the same scope,
// with no direct eval or loop capture, so the keyword rewrite proceeds.
//
//  1. Parse `var x = 1;` as the only declaration of `x`.
//  2. Apply the no-var finding's text edit through the disk-backed fixer.
//  3. Assert only the `var` keyword changed to `let`.
//
// An explicit module owns the binding; var does not create a global-object property.
//
// @evidence contracts/testing.md#behavioral-verification no-var rewrites the sole x declaration without changing its initializer or use.
// @evidence contracts/testing.md#independent-expectations The independently authored let x source specifies the safe unique-binding result exactly.
// @evidence contracts/testing.md#distinguishing-cases One binding and no preceding value read distinguish this arm from redeclaration and forward-reference refusals.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarReplacesUniqueBinding calls assertFixSnapshot with no-var over x and its trailing use.
func TestFixNoVarReplacesUniqueBinding(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-var",
    "var x = 1;\nJSON.stringify(x);\nexport {};\n",
    "let x = 1;\nJSON.stringify(x);\nexport {};\n",
  )
}
