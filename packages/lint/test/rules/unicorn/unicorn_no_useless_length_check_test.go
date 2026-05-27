package linthost

import "testing"

// TestRuleCorpusUnicornNoUselessLengthCheck verifies the rule reports
// `xs.length > 0 && xs.every(...)` where the length guard is redundant.
//
// The rule pairs an `X.length > 0` LHS with a `X.every(...)` RHS that
// already returns `true` for an empty array. This fixture pins the
// `every` arm against the textual-receiver match.
//
// 1. Enable unicorn/no-useless-length-check via an expect annotation.
// 2. Compose `xs.length > 0 && xs.every((x) => x > 0)`.
// 3. Assert the binary expression is reported.
func TestRuleCorpusUnicornNoUselessLengthCheck(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/no-useless-length-check.ts", "declare const xs: number[];\n// expect: unicorn/no-useless-length-check error\nconst all = xs.length > 0 && xs.every((x) => x > 0);\nvoid all;\n")
}
