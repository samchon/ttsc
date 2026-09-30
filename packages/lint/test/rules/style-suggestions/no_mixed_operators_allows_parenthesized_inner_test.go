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
//
// @evidence contracts/testing.md#behavioral-verification Permits explicitly grouped (a&&b)||c.
// @evidence contracts/testing.md#independent-expectations Parentheses acknowledge the inner grouping, so the authored zero result follows the supported readability exemption.
// @evidence contracts/testing.md#distinguishing-cases Same operators report without parentheses in the left-of-or sibling.
// @evidence contracts/testing.md#execution-ownership assertRuleSkipsSource executes this entry's exact authored source through the enabled engine rule; this Test owns its zero-finding comparison. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestNoMixedOperatorsAllowsParenthesizedInner(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "no-mixed-operators",
    "const x = (a && b) || c;\n",
  )
}
