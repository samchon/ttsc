package linthost

import "testing"

// TestFixNoVarSkipsForHeaderRedeclaration verifies no-var declines a `var`
// that is redeclared by a `for`-header `var` later in the file.
//
// Rewriting the outer `var x` to `let x` while the header still declares
// `var x` creates a lexical/var collision. The binding census visits the
// VariableDeclaration inside both statement-owned and header-owned lists;
// it sees two x declarations and declines the rewrite of either one.
//
//  1. Parse `var x = 0;` followed by `for (var x = 1; x < 3; x++) {}`.
//  2. Run the no-var fixer through the disk-backed applier.
//  3. Assert the diagnostic fires but no text edit is applied.
//
// The original script is retained. A sloppy-function counterpart runs the
// same body so global-object binding exposure cannot mask this named guard.
//
// @evidence contracts/testing.md#behavioral-verification no-var leaves outer x and a later for-header redeclaration of x unchanged.
// @evidence contracts/testing.md#independent-expectations The original two-binding source and zero fixes preserve a legal var redeclaration instead of producing duplicate lexical bindings. Exact literal statement/header spans additionally require both distinct diagnostics.
// @evidence contracts/testing.md#distinguishing-cases A header declaration must count beside a statement declaration; the single unique header case fixes.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarSkipsForHeaderRedeclaration applies assertNoFixSnapshot to both x declarations in one source. Its assertRuleFindingRanges call owns both declaration identities.
func TestFixNoVarSkipsForHeaderRedeclaration(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "var x = 0;\nfor (var x = 1; x < 3; x++) {}\n",
  )
  assertNoFixSnapshot(
    t,
    "no-var",
    "function noVarFixture(){\nvar x = 0;\nfor (var x = 1; x < 3; x++) {}\n}\n",
  )
  assertRuleFindingRanges(t, "no-var", "var x = 0;\nfor (var x = 1; x < 3; x++) {}\n", "var x = 0;", "var x = 1")
}
