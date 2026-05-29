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
func TestFormatDeclarationHeaderAbstainsOnTypeParamsWithMultiClause(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/declaration-header",
    "class C<TKeyVeryLong extends string> extends Base implements First, Second {\n  a = 1;\n}\n",
    `{"printWidth":50,"tabWidth":2}`,
  )
}
