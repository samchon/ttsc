package linthost

import "testing"

// TestRuleCorpusUnicornNumberLiteralCase verifies unicorn/number-literal-case
// reports a hex literal with lowercase digits.
//
// Canonical form is lowercase prefix + uppercase digits (`0xFF`); the
// fixture exercises `0xff`, the most common non-canonical shape, to pin
// the lowercase-digit branch.
//
// 1. Enable unicorn/number-literal-case via an expect annotation.
// 2. Declare a const initialized to `0xff`.
// 3. Assert the literal is reported.
func TestRuleCorpusUnicornNumberLiteralCase(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/number-literal-case.ts", "// expect: unicorn/number-literal-case error\nconst n = 0xff;\n")
}
