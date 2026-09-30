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
//
// @evidence contracts/testing.md#behavioral-verification no-var leaves both var x declarations unchanged instead of making duplicate lets.
// @evidence contracts/testing.md#independent-expectations The original two-declaration source and zero applied fixes preserve supported var redeclaration. Exact literal statement/header spans additionally require both distinct diagnostics.
// @evidence contracts/testing.md#distinguishing-cases Two declarations differ from a single binding and from reassignment, which remains fixable.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarSkipsRedeclaration calls assertNoFixSnapshot on its two var statements. Its assertRuleFindingRanges call owns both declaration identities.
func TestFixNoVarSkipsRedeclaration(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "var x = 1;\nvar x = 2;\n",
  )
  assertRuleFindingRanges(t, "no-var", "var x = 1;\nvar x = 2;\n", "var x = 1;", "var x = 2;")
}
