package linthost

import "testing"

// TestRuleCorpusUnicornPreferBigintLiterals verifies
// unicorn/prefer-bigint-literals reports a `BigInt(1)` call.
//
// The rule fires when a bare `BigInt` identifier is called with one
// numeric-literal argument (or a digit-only string literal). The fixture
// exercises the numeric-literal branch, which is the canonical
// rewrite case.
//
// 1. Enable unicorn/prefer-bigint-literals via an expect annotation.
// 2. Declare a const initialized to `BigInt(1)`.
// 3. Assert the call expression is reported.
func TestRuleCorpusUnicornPreferBigintLiterals(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/prefer-bigint-literals.ts", "// expect: unicorn/prefer-bigint-literals error\nconst big = BigInt(1);\n")
}
