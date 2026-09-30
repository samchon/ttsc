package linthost

import "testing"

// TestFixNoVarSkipsCrossCaseReference verifies no-var declines the fix for a
// `var` declared in one switch case and referenced from a later case.
//
// A `let` in a case clause hoists to the whole switch block, so the rewrite
// still compiles — but when the later case executes without the declaring
// case having run, the read flips from `var`'s `undefined` to a runtime TDZ
// ReferenceError. The gate bounds the scope at the CaseClause itself, so a
// cross-case reference declines (over-declining never corrupts).
//
//  1. Parse a switch declaring `var x` in case 1 and reading `x` in case 2.
//  2. Run the no-var fixer through the disk-backed applier.
//  3. Assert at least one finding fired but zero fixes were applied.
//
// @evidence contracts/testing.md#behavioral-verification no-var refuses to rewrite x declared in case 1 and read in case 2.
// @evidence contracts/testing.md#independent-expectations The original switch source and zero edits preserve var hoisting rather than introducing a later-case temporal dead zone.
// @evidence contracts/testing.md#distinguishing-cases A cross-clause read differs from TestFixNoVarReplacesSameCaseClauseReferences; the diagnostic must remain active.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarSkipsCrossCaseReference calls assertNoFixSnapshot for the two-clause switch source.
func TestFixNoVarSkipsCrossCaseReference(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "switch (JSON.parse(\"1\")) {\n  case 1:\n    var x = 1;\n    break;\n  case 2:\n    JSON.stringify(x);\n    break;\n}\n",
  )
}
