package linthost

import "testing"

// TestFixNoVarFixesDespiteMemberNameBefore verifies no-var still rewrites a
// `var` whose name also appears as a property-access member name above it.
//
// The use-before-declaration gate matched any identifier by text, so a member
// name like `o.x` occurring before `var x` looked like a forward reference and
// forced an over-decline. A property-access member binds no value, so the AST
// role check now excludes it and the safe rewrite to `let` proceeds.
//
//  1. Parse `o.x;` (member access) before `var x = 1;`.
//  2. Apply the no-var finding's text edit through the disk-backed fixer.
//  3. Assert only the `var` keyword changed to `let`.
//
// @evidence contracts/testing.md#behavioral-verification no-var fixes var x after o.x without mistaking the member name for a forward binding read.
// @evidence contracts/testing.md#independent-expectations Literal expected let x preserves o.x and the o initializer; a member name independently denotes a property rather than this binding.
// @evidence contracts/testing.md#distinguishing-cases Member access precedes the declaration but remains fixable, unlike a direct x value read before declaration.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarFixesDespiteMemberNameBefore calls assertFixSnapshot for its o.x fixture in the shared Go unit process.
func TestFixNoVarFixesDespiteMemberNameBefore(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-var",
    "const o = { x: 0 };\no.x;\nvar x = 1;\nJSON.stringify([o, x]);\n",
    "const o = { x: 0 };\no.x;\nlet x = 1;\nJSON.stringify([o, x]);\n",
  )
}
