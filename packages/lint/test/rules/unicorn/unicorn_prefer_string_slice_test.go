package linthost

import "testing"

// TestRuleCorpusUnicornPreferStringSlice verifies unicorn/prefer-string-slice
// reports `.substr(…)` and `.substring(…)` callsites.
//
// The rule treats both names as banned regardless of receiver type — `substr`
// is deprecated and `substring` has surprising swap-arguments semantics — so
// the AST-only callee match is sufficient. This fixture pins the `.substr`
// arm; the `.substring` arm shares the same matcher and need not duplicate it.
//
// 1. Enable unicorn/prefer-string-slice via an expect annotation.
// 2. Call `.substr(0, 3)` on a string literal.
// 3. Assert the call expression is reported.
func TestRuleCorpusUnicornPreferStringSlice(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-string-slice.ts", "// expect: unicorn/prefer-string-slice error\nconst s = \"hello\".substr(0, 3);\n")
}
