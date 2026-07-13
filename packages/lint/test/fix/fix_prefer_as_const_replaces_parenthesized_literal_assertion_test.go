package linthost

import "testing"

// TestFixPreferAsConstReplacesParenthesizedLiteralAssertion verifies preferAsConst sees through expression parens.
//
// ESTree does not represent expression parentheses, so the upstream rule
// receives the bare literal in `('a') as 'a'` and reports it. The tsgo AST
// keeps a ParenthesizedExpression wrapper the matcher must descend through;
// the fix still replaces only the literal type, leaving the parenthesized
// expression untouched.
//
// 1. Parse a source file with `("literal") as "literal"`.
// 2. Apply the preferAsConst finding through the disk-backed fixer.
// 3. Assert only the literal type changed to `const`.
func TestFixPreferAsConstReplacesParenthesizedLiteralAssertion(t *testing.T) {
  assertFixSnapshot(
    t,
    "typescript/prefer-as-const",
    "const value = (\"literal\") as \"literal\";\nJSON.stringify(value);\n",
    "const value = (\"literal\") as const;\nJSON.stringify(value);\n",
  )
}
