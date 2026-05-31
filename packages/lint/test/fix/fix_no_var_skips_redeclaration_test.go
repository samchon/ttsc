package linthost

import "testing"

// TestFixNoVarSkipsRedeclaration verifies no-var reports but does not rewrite a
// redeclared binding.
//
// `var x=1; var x=2;` is legal under `var` hoisting but rewriting both keywords
// to `let` yields a duplicate-`let` SyntaxError. With no scope engine, the
// safety gate declines any binding name that appears in more than one `var`
// declaration in the file, so the diagnostic still fires but no text edit is
// applied and the source stays intact.
//
//  1. Parse a file that declares `var x` twice.
//  2. Run the no-var fixer through the disk-backed applier.
//  3. Assert at least one finding fired but zero fixes were applied.
func TestFixNoVarSkipsRedeclaration(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "var x = 1;\nvar x = 2;\n",
  )
}
