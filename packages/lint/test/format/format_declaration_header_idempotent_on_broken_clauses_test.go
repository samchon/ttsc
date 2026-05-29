package linthost

import "testing"

// TestFormatDeclarationHeaderIdempotentOnBrokenClauses verifies the rule
// reproduces an already-correct multi-clause header byte-for-byte so the
// cascade converges.
//
//  1. Parse a class header already in the Prettier multi-clause shape.
//  2. Run format/declaration-header at printWidth 50.
//  3. Assert the rule reports nothing.
func TestFormatDeclarationHeaderIdempotentOnBrokenClauses(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/declaration-header",
    "class C\n  extends Base\n  implements First, Second, Third, Fourth\n{\n  a = 1;\n}\n",
    `{"printWidth":50,"tabWidth":2}`,
  )
}
