package linthost

import "testing"

// TestFixNoVarSkipsParameterRedeclaration verifies no-var reports but does not
// rewrite a `var` that shares its name with an enclosing function parameter.
//
// `function f(x) { var x = 1; }` is legal: a function-scoped `var` may reuse a
// parameter name, the `var` just re-binds the same slot. Rewriting the keyword
// to `let` yields `let x = 1` alongside parameter `x`, a duplicate-declaration
// SyntaxError. The single-binding-in-file gate counts `x` twice (parameter +
// var), so the fix is declined while the diagnostic still fires.
//
//  1. Parse `function f(x) { var x = 1; }`.
//  2. Run the no-var fixer through the disk-backed applier.
//  3. Assert at least one finding fired but zero fixes were applied.
func TestFixNoVarSkipsParameterRedeclaration(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "function f(x) {\n  var x = 1;\n  return x;\n}\nJSON.stringify(f(0));\n",
  )
}
