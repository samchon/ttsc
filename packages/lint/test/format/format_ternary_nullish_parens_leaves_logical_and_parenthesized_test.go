package linthost

import "testing"

// TestFormatTernaryNullishParensLeavesLogicalAndParenthesized verifies
// the rule does not touch `||`/`&&` operands and is idempotent on an
// already-parenthesized `??`.
//
// Only `??` needs the parens under Prettier 3; logical-or/and arms stay
// bare, and a `(a ?? b)` that already has parents parses as a
// parenthesized expression (not a bare `??`) so the rule must not
// double-wrap.
//
//  1. Parse a conditional with a `||` arm and an already-wrapped `??` arm.
//  2. Run format/ternary-nullish-parens.
//  3. Assert the rule reports nothing.
func TestFormatTernaryNullishParensLeavesLogicalAndParenthesized(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/ternary-nullish-parens",
    "const r = cond ? a || b : (c ?? d);\n",
  )
}
