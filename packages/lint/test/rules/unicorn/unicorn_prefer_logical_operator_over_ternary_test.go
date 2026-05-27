package linthost

import "testing"

// TestRuleCorpusUnicornPreferLogicalOperatorOverTernary verifies
// unicorn/prefer-logical-operator-over-ternary reports `x ? x : 0`.
//
// The fixture pins the `cond ? cond : alt` shape — the canonical positive
// case. The match is purely textual (the condition and `whenTrue`
// expressions must read identically after stripping parens), so a single
// declared identifier with a literal fallback exercises the core branch
// without dragging in a comparison or the negated alternative shape.
//
// 1. Enable unicorn/prefer-logical-operator-over-ternary via an expect annotation.
// 2. Declare `const y = x ? x : 0;`.
// 3. Assert the conditional expression is reported.
func TestRuleCorpusUnicornPreferLogicalOperatorOverTernary(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/prefer-logical-operator-over-ternary.ts", "declare const x: number | undefined;\n// expect: unicorn/prefer-logical-operator-over-ternary error\nconst y = x ? x : 0;\nvoid y;\n")
}
