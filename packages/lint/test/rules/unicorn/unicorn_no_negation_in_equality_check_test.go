package linthost

import "testing"

// TestRuleCorpusUnicornNoNegationInEqualityCheck verifies
// unicorn/no-negation-in-equality-check reports `!a === b`, whose
// associativity (`(!a) === b`) almost never matches the author's
// intent.
//
// The rule visits each `BinaryExpression`, matches on the four
// equality operator tokens, and checks whether the left operand
// (after stripping parens) is a `!` prefix-unary expression. The
// fixture uses `declare const` so the operands carry types without
// adding noise.
//
// 1. Enable unicorn/no-negation-in-equality-check via an expect annotation.
// 2. Write `const eq = !a === b;` on declared variables.
// 3. Assert the equality binary expression is reported.
func TestRuleCorpusUnicornNoNegationInEqualityCheck(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/no-negation-in-equality-check.ts", "declare const a: number;\ndeclare const b: number;\n// expect: unicorn/no-negation-in-equality-check error\nconst eq = !a === b;\nvoid eq;\n")
}
