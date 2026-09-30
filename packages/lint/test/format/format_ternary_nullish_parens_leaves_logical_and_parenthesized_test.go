package linthost

import "testing"

// TestFormatTernaryNullishParensLeavesLogicalAndParenthesized verifies
// the rule does not touch `||`/`&&` operands and is idempotent on an
// already-parenthesized `??`.
//
// Only `??` needs the parens under Prettier 3; logical-or/and arms stay
// bare, and a `(a ?? b)` that already has parentheses parses as a
// parenthesized expression (not a bare `??`) so the rule must not
// double-wrap.
//
//  1. Parse logical-and/or operands and already-wrapped nullish operands.
//  2. Run format/ternary-nullish-parens.
//  3. Assert the rule reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification The owning ternary-nullish rule must abstain on logical-and/or operands and already parenthesized nullish operands. No-finding assertions detect treating every binary operator as nullish or double-wrapping canonical input.
// @evidence contracts/testing.md#independent-expectations Installed Prettier 3.8.3 leaves logical operands bare and retains these existing nullish parentheses. The authored canonical spellings determine no change independently of the rule operator switch.
// @evidence contracts/testing.md#distinguishing-cases The original logical-or and wrapped-nullish fixture remains. Added logical-and/or positions and the fully wrapped three-nullish conditional distinguish operator eligibility and the canonical fixed point from WrapsAllPositions positives.
// @evidence contracts/testing.md#execution-ownership TestFormatTernaryNullishParensLeavesLogicalAndParenthesized owns every authored negative source in the public Go unit population. The syntax-only owning rule executes in process without consumer installation, native builds or real product hosts.
func TestFormatTernaryNullishParensLeavesLogicalAndParenthesized(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/ternary-nullish-parens",
    "const r = cond ? a || b : (c ?? d);\n",
  )
  assertRuleSkipsSource(t, "format/ternary-nullish-parens", "const r = a && b ? c || d : (e ?? f);\n")
  assertRuleSkipsSource(t, "format/ternary-nullish-parens", "const r = (a ?? b) ? (c ?? d) : (e ?? f);\n")
}
