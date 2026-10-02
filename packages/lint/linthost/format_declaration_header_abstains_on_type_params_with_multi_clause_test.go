package linthost

import "testing"

// TestFormatDeclarationHeaderAbstainsOnTypeParamsWithMultiClause verifies
// the rule abstains on a combination it has not verified against Prettier:
// type parameters AND a breaking multi-clause heritage at once. Emitting a
// header it cannot reproduce exactly risks corruption, so it leaves the
// source verbatim.
//
//  1. Parse a class with type parameters plus extends + implements that
//     overflows printWidth 50.
//  2. Run format/declaration-header.
//  3. Assert the rule reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification format/declaration-header must decline an overflowing class combining constrained type parameters with extends and implements rather than applying an unsupported header rewrite.
// @evidence contracts/testing.md#independent-expectations The literal TKeyVeryLong constraint and two heritage clauses specify the unsupported combination independently; this case expects zero findings, not an inferred snapshot.
// @evidence contracts/testing.md#distinguishing-cases The generic-plus-multiple-clause negative complements separate type-parameter explosion and nongeneric multi-clause reflow positives; this host owns only the combined guard.
// @evidence contracts/testing.md#execution-ownership TestFormatDeclarationHeaderAbstainsOnTypeParamsWithMultiClause is selected by the lint semantic-unit Evidence claim as a public Go unit. The owning formatter rule runs through the shared syntax-only rule harness on temporary fixture source; this entry owns its assertions and any named subtests without consumer installation, native product build or host process.
func TestFormatDeclarationHeaderAbstainsOnTypeParamsWithMultiClause(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/declaration-header",
    "class C<TKeyVeryLong extends string> extends Base implements First, Second {\n  a = 1;\n}\n",
    `{"printWidth":50,"tabWidth":2}`,
  )
}
