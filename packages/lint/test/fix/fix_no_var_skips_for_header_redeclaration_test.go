package linthost

import "testing"

// TestFixNoVarSkipsForHeaderRedeclaration verifies no-var declines a `var`
// that is redeclared by a `for`-header `var` later in the file.
//
// The redeclaration scan originally counted only KindVariableStatement
// occurrences, so a `for`-header `var` (a bare VariableDeclarationList, not a
// statement) was invisible. Rewriting the outer `var x` to `let x` while
// `for (var x = 1; …)` still declares `var x` produces a duplicate-declaration
// SyntaxError. The fix folds for/for-in/for-of initializer `var` lists into the
// occurrence count, so the binding now appears twice and the fixer declines.
//
//  1. Parse `var x = 0;` followed by `for (var x = 1; x < 3; x++) {}`.
//  2. Run the no-var fixer through the disk-backed applier.
//  3. Assert the diagnostic fires but no text edit is applied.
func TestFixNoVarSkipsForHeaderRedeclaration(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "var x = 0;\nfor (var x = 1; x < 3; x++) {}\n",
  )
}
