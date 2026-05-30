package linthost

import "testing"

// TestFixNoVarSkipsFunctionDeclarationRedeclaration verifies no-var reports but
// does not rewrite a `var` that shares its name with a hoisted function
// declaration.
//
// `var x=1; function x(){}` is legal: a function-scoped `var` and a hoisted
// function declaration may share a name. Rewriting the `var` keyword to `let`
// yields `let x=1; function x(){}`, a duplicate-declaration SyntaxError
// (`Identifier 'x' has already been declared`). With no scope engine, the
// safety gate must treat a same-name function/class declaration as another
// occurrence of the binding name, so the diagnostic still fires but no text
// edit is applied and the source stays intact.
//
//  1. Parse a file that declares `var x` and `function x`.
//  2. Run the no-var fixer through the disk-backed applier.
//  3. Assert at least one finding fired but zero fixes were applied.
func TestFixNoVarSkipsFunctionDeclarationRedeclaration(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "var x = 1;\nfunction x() {}\n",
  )
}
