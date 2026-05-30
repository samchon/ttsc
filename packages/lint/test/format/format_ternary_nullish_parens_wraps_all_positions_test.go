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
func TestFormatTernaryNullishParensWrapsAllPositions(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/ternary-nullish-parens",
    "const r = a ?? b ? c ?? d : e ?? f;\n",
    "const r = (a ?? b) ? (c ?? d) : (e ?? f);\n",
  )
}
