package linthost

import "testing"

// TestFixNoVarSkipsMixedDestructureRedeclaration verifies no-var reports but
// does not rewrite a mixed declaration list whose destructured sibling is
// redeclared elsewhere.
//
// `var a = 1, { b } = o;` binds both a plain `a` and a destructured `b` under
// one `var` keyword. The binding-name helper deliberately skips destructuring,
// so only `a` is seen and the single-plain-binding guard passes — yet the same
// keyword governs `b`. A later `var b = 2;` then redeclares `b`, so rewriting
// the keyword to `let` would yield a duplicate-`let` SyntaxError. The
// declaration-count guard declines because the list holds two
// VariableDeclaration nodes, so the diagnostic still fires but no edit lands.
//
//  1. Parse a file with a mixed plain+destructure list and a later `var b`.
//  2. Run the no-var fixer through the disk-backed applier.
//  3. Assert at least one finding fired but zero fixes were applied.
func TestFixNoVarSkipsMixedDestructureRedeclaration(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "var a = 1, { b } = o;\nvar b = 2;\n",
  )
}
