package linthost

import "testing"

// TestRuleCorpusUnicornPreferDateNow verifies unicorn/prefer-date-now
// reports `new Date().getTime()`.
//
// The rule covers three shapes — `.getTime()`, `.valueOf()`, and
// `+new Date()`. The fixture pins the `.getTime()` shape, which
// exercises the CallExpression → PropertyAccess → NewExpression
// walk that the other call-form shares.
//
// 1. Enable unicorn/prefer-date-now via an expect annotation.
// 2. Declare a const initialized to `new Date().getTime()`.
// 3. Assert the call expression is reported.
func TestRuleCorpusUnicornPreferDateNow(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/prefer-date-now.ts", "// expect: unicorn/prefer-date-now error\nconst t = new Date().getTime();\n")
}
