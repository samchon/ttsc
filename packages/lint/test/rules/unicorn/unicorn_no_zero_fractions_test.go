package linthost

import "testing"

// TestRuleCorpusUnicornNoZeroFractions verifies unicorn/no-zero-fractions
// reports a numeric literal with a redundant `.0` fraction.
//
// The parser normalizes `.Text` (it drops trailing zeros and trailing
// dots), so the rule has to read raw source via `nodeText`. This fixture
// pins the most common shape, `1.0`, so the raw-text path stays covered.
//
// 1. Enable unicorn/no-zero-fractions via an expect annotation.
// 2. Declare a const initialized to `1.0`.
// 3. Assert the literal is reported.
func TestRuleCorpusUnicornNoZeroFractions(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/no-zero-fractions.ts", "// expect: unicorn/no-zero-fractions error\nconst n = 1.0;\n")
}
