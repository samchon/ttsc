package linthost

import "testing"

// TestFormatTernaryNullishParensWrapsAllPositions verifies a `??` operand
// in any of a conditional's three positions is parenthesized, matching
// Prettier 3.
//
// Prettier 3 wraps a nullish-coalescing condition, consequent, or
// alternate of a `?:` for clarity (TypeScript allows the bare form, but
// Prettier adds the parens). `||`/`&&` are left bare.
//
//  1. Parse a conditional whose condition, consequent, and alternate are
//     each a bare `??` expression.
//  2. Apply format/ternary-nullish-parens.
//  3. Assert all three are parenthesized.
//
// @evidence contracts/testing.md#behavioral-verification The owning ternary-nullish rule must parenthesize each of condition, consequent and alternate without changing identifiers, operators or the conditional structure. The complete literal output detects missing a position or wrapping the wrong span.
// @evidence contracts/testing.md#independent-expectations Installed Prettier 3.8.3 formats this authored conditional with parentheses around all three nullish operands. Parenthesizing each complete operand preserves its existing TypeScript grouping and independently supplies the literal output.
// @evidence contracts/testing.md#distinguishing-cases One conditional has all three nullish positions as positives. LeavesLogicalAndParenthesized supplies logical-and, logical-or and already wrapped negatives, including a fully canonical three-position counterpart.
// @evidence contracts/testing.md#execution-ownership TestFormatTernaryNullishParensWrapsAllPositions owns the literal input/output in the public Go unit population. The syntax-only owning rule and edit application run in process without consumer installation, native artifact building or a product host.
func TestFormatTernaryNullishParensWrapsAllPositions(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/ternary-nullish-parens",
    "const r = a ?? b ? c ?? d : e ?? f;\n",
    "const r = (a ?? b) ? (c ?? d) : (e ?? f);\n",
  )
}
