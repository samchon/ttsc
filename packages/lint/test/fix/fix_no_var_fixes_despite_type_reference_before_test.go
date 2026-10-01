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
//
// An explicit module owns the binding; var does not create a global-object property.
//
// @evidence contracts/testing.md#behavioral-verification no-var rewrites the value binding T despite a preceding type annotation named T.
// @evidence contracts/testing.md#independent-expectations The authored let T result preserves the type alias and v annotation, which independently occupy TypeScript type space.
// @evidence contracts/testing.md#distinguishing-cases A same-spelled type reference must not act like a forward value read; both namespaces coexist in this fixture.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarFixesDespiteTypeReferenceBefore calls assertFixSnapshot on the T type/value fixture using no-var.
func TestFixNoVarFixesDespiteTypeReferenceBefore(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-var",
    "let v: T = 0;\nvar T = 1;\ntype T = number;\nJSON.stringify([v, T]);\nexport {};\n",
    "let v: T = 0;\nlet T = 1;\ntype T = number;\nJSON.stringify([v, T]);\nexport {};\n",
  )
}
