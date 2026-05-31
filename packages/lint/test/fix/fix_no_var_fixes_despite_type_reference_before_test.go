package linthost

import "testing"

// TestFixNoVarFixesDespiteTypeReferenceBefore verifies no-var still rewrites a
// `var` whose name also appears as a type reference above it.
//
// A type reference (`: x`) lives in the type namespace, not the value
// namespace, so it must not be read as a forward value reference that forces
// an over-decline. The AST role check excludes type-reference names, leaving
// the safe rewrite to `let` intact.
//
//  1. Parse a `let v: T` type annotation before `var T = 1;`, with the `type
//     T` declaration following so only the type-reference occurrence precedes
//     the `var`.
//  2. Apply the no-var finding's text edit through the disk-backed fixer.
//  3. Assert only the `var` keyword changed to `let`.
func TestFixNoVarFixesDespiteTypeReferenceBefore(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-var",
    "let v: T = 0;\nvar T = 1;\ntype T = number;\nJSON.stringify([v, T]);\n",
    "let v: T = 0;\nlet T = 1;\ntype T = number;\nJSON.stringify([v, T]);\n",
  )
}
