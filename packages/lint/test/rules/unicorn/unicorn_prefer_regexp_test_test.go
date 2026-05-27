package linthost

import "testing"

// TestRuleCorpusUnicornPreferRegexpTest verifies
// unicorn/prefer-regexp-test reports `.match(/…/)` and `.exec(…)` calls
// that sit in a boolean position.
//
// The rule matches `match` / `exec` callees and walks the parent chain
// to confirm the call is consumed only for its truthiness — the
// condition slot of `if` / `?:`, the operand of `!`, or a side of the
// short-circuit operators. This fixture pins the `if`-condition arm
// with `String#match()` so the if-condition branch stays covered.
//
// 1. Enable unicorn/prefer-regexp-test via an expect annotation.
// 2. Use `"abc".match(/a/)` as an `if` condition.
// 3. Assert the call expression is reported.
func TestRuleCorpusUnicornPreferRegexpTest(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/prefer-regexp-test.ts", "// expect: unicorn/prefer-regexp-test error\nif (\"abc\".match(/a/)) {\n  void 0;\n}\n")
}
