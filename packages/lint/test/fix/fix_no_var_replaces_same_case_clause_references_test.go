package linthost

import "testing"

// TestFixNoVarReplacesSameCaseClauseReferences verifies no-var still rewrites
// a `var` declared and referenced within a single switch case clause.
//
// Positive twin of the cross-case decline: the gate bounds the scope at the
// CaseClause, so references inside the same clause pass containment and the
// clause-local shape keeps its autofix. Pins the CaseClause arm of the
// block-scope-container classifier.
//
//  1. Parse a switch whose case 1 declares `var x` and reads it in-clause.
//  2. Apply the no-var finding's text edit through the disk-backed fixer.
//  3. Assert only the `var` keyword changed to `let`.
func TestFixNoVarReplacesSameCaseClauseReferences(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-var",
    "switch (JSON.parse(\"1\")) {\n  case 1:\n    var x = 1;\n    JSON.stringify(x);\n    break;\n}\n",
    "switch (JSON.parse(\"1\")) {\n  case 1:\n    let x = 1;\n    JSON.stringify(x);\n    break;\n}\n",
  )
}
