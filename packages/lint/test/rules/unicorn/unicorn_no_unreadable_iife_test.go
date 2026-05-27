package linthost

import "testing"

// TestRuleCorpusUnicornNoUnreadableIife verifies the rule reports an IIFE
// whose arrow body is itself a call expression.
//
// `(() => Math.random())()` is two layers of invocation for one
// effective call — the inner call site is hidden behind an anonymous
// arrow. The rule visits `KindCallExpression`, requires the callee to
// be a `KindParenthesizedExpression` wrapping a `KindArrowFunction`,
// and requires the arrow's body to be itself a `KindCallExpression`.
// The fixture pins that exact arrow→call shape.
//
// 1. Enable unicorn/no-unreadable-iife via an expect annotation.
// 2. Assign `(() => Math.random())()` to a const.
// 3. Assert the outer call is reported.
func TestRuleCorpusUnicornNoUnreadableIife(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/no-unreadable-iife.ts", "// expect: unicorn/no-unreadable-iife error\nconst r = (() => Math.random())();\nvoid r;\n")
}
