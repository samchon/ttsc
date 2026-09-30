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
//
// @evidence contracts/testing.md#behavioral-verification no-var diagnoses but does not fix x read before its declaration.
// @evidence contracts/testing.md#independent-expectations Original source identity and zero applied edits preserve the forward hoisted-var read.
// @evidence contracts/testing.md#distinguishing-cases A true value reference before var differs from member, label, key and type occurrences that remain fixable.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarSkipsUseBeforeDeclaration executes assertNoFixSnapshot over JSON.stringify(x) before var x.
func TestFixNoVarSkipsUseBeforeDeclaration(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "JSON.stringify(x);\nvar x = 1;\n",
  )
}
