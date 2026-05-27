package linthost

import "testing"

// TestRuleCorpusUnicornPreferStringTrimStartEnd verifies
// unicorn/prefer-string-trim-start-end reports the deprecated `.trimLeft()`
// and `.trimRight()` callsites.
//
// Both deprecated names share one matcher: a `CallExpression` whose callee is
// a `PropertyAccessExpression` ending in `trimLeft` or `trimRight`. This
// fixture pins the `.trimLeft()` arm; the `.trimRight()` arm shares the
// matcher and needs no duplicate fixture.
//
// 1. Enable unicorn/prefer-string-trim-start-end via an expect annotation.
// 2. Call `.trimLeft()` on a padded string literal.
// 3. Assert the call expression is reported.
func TestRuleCorpusUnicornPreferStringTrimStartEnd(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/prefer-string-trim-start-end.ts", "// expect: unicorn/prefer-string-trim-start-end error\nconst s = \"  hi  \".trimLeft();\n")
}
