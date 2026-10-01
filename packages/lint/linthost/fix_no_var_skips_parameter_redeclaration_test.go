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
//
// @evidence contracts/testing.md#behavioral-verification no-var diagnoses function-local var x but leaves its same-named parameter intact.
// @evidence contracts/testing.md#independent-expectations The authored function source and zero edits avoid an illegal lexical duplicate beside parameter x.
// @evidence contracts/testing.md#distinguishing-cases Parameter reuse differs from the single unique declaration positive arm.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarSkipsParameterRedeclaration runs assertNoFixSnapshot on f(x) and its inner var x.
func TestFixNoVarSkipsParameterRedeclaration(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "function f(x) {\n  var x = 1;\n  return x;\n}\nJSON.stringify(f(0));\n",
  )
}
