package linthost

import "testing"

// TestRuleCorpusUnicornNoUselessLengthCheck verifies the rule reports
// `xs.length > 0 && xs.some(...)` where the length guard is redundant.
//
// The rule pairs an `X.length > 0` LHS with a `X.some(...)` RHS that
// already returns `false` for an empty array, so the leading length
// check changes nothing. `every`, `map`, and `filter` are intentionally
// excluded from the `&&` set because their empty-array return values
// (true / empty array) DO make the length check load-bearing.
//
// 1. Enable unicorn/no-useless-length-check via an expect annotation.
// 2. Compose `xs.length > 0 && xs.some((x) => x > 0)`.
// 3. Assert the binary expression is reported.
func TestRuleCorpusUnicornNoUselessLengthCheck(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/no-useless-length-check.ts", "declare const xs: number[];\n// expect: unicorn/no-useless-length-check error\nconst any = xs.length > 0 && xs.some((x) => x > 0);\nvoid any;\n")
}
