package linthost

import "testing"

// TestFixNoVarSkipsUseBeforeDeclaration verifies no-var reports but does not
// rewrite a binding referenced before its declaration line.
//
// Under `var` hoisting `log(x); var x = 1;` reads `undefined`; rewriting the
// keyword to `let` turns that earlier read into a TDZ ReferenceError. With no
// scope engine, the safety gate declines when a declared name is referenced
// anywhere before the statement's Pos(), so the diagnostic fires but the source
// keeps its `var`.
//
//  1. Parse a file that references `x` before declaring `var x`.
//  2. Run the no-var fixer through the disk-backed applier.
//  3. Assert at least one finding fired but zero fixes were applied.
func TestFixNoVarSkipsUseBeforeDeclaration(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "JSON.stringify(x);\nvar x = 1;\n",
  )
}
