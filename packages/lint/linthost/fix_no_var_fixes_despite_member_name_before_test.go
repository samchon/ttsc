package linthost

import "testing"

// TestFixNoVarFixesDespiteMemberNameBefore verifies no-var still rewrites a
// `var` whose name also appears as a property-access member name above it.
//
// A member name like `o.x` before `var x` is not a forward reference to
// that variable. The use-before-declaration gate must classify its AST role
// rather than decline on matching text; the safe rewrite to `let` proceeds.
//
//  1. Parse `o.x;` (member access) before `var x = 1;`.
//  2. Apply the no-var finding's text edit through the disk-backed fixer.
//  3. Assert only the `var` keyword changed to `let`.
//
// An explicit module owns the binding; var does not create a global-object property.
//
// @evidence contracts/testing.md#behavioral-verification no-var fixes var x after o.x without mistaking the member name for a forward binding read.
// @evidence contracts/testing.md#independent-expectations Literal expected let x preserves o.x and the o initializer; a member name independently denotes a property rather than this binding.
// @evidence contracts/testing.md#distinguishing-cases Member access precedes the declaration but remains fixable, unlike a direct x value read before declaration.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarFixesDespiteMemberNameBefore calls assertFixSnapshot for its o.x fixture in the shared Go unit process.
func TestFixNoVarFixesDespiteMemberNameBefore(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-var",
    "const o = { x: 0 };\no.x;\nvar x = 1;\nJSON.stringify([o, x]);\nexport {};\n",
    "const o = { x: 0 };\no.x;\nlet x = 1;\nJSON.stringify([o, x]);\nexport {};\n",
  )
}
