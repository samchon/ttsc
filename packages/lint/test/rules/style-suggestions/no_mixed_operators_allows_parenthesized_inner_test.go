package linthost

import "testing"

// TestNoMixedOperatorsAllowsParenthesizedInner verifies `(a && b) || c` is NOT
// flagged.
//
// Explicit parentheses are the author acknowledging the grouping. In the
// TypeScript AST the wrapped operand is a ParenthesizedExpression, so the inner
// `a && b` has a non-binary parent and is skipped without ESLint's token-level
// paren probe. This pins that structural skip.
//
// 1. Write `const x = (a && b) || c;`.
// 2. Enable no-mixed-operators with default options.
// 3. Assert zero findings.
func TestNoMixedOperatorsAllowsParenthesizedInner(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "no-mixed-operators",
    "const x = (a && b) || c;\n",
  )
}
