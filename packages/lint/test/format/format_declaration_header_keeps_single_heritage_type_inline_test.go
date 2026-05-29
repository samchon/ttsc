package linthost

import "testing"

// TestFormatDeclarationHeaderKeepsSingleHeritageTypeInline verifies a
// lone `extends X<Y>` is never broken, even when it overflows.
//
// Prettier keeps a single heritage type inline (it has nothing to break
// into a list), so the rule must abstain rather than invent a break.
//
//  1. Parse an interface with one long extends type (printWidth 50).
//  2. Run format/declaration-header.
//  3. Assert the rule reports nothing.
func TestFormatDeclarationHeaderKeepsSingleHeritageTypeInline(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/declaration-header",
    "interface A extends SomeReallyLongBaseInterfaceName<WithArgs> {\n  a: number;\n}\n",
    `{"printWidth":50,"tabWidth":2}`,
  )
}
