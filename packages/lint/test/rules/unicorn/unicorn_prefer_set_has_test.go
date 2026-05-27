package linthost

import "testing"

// TestRuleCorpusUnicornPreferSetHas verifies unicorn/prefer-set-has reports
// `[…].includes(x)` against a literal array receiver.
//
// The minimum-viable port only flags literal-array receivers — the upstream
// rule additionally reasons about typed variable receivers, which needs type
// flow analysis out of scope for this slice. This fixture pins the literal arm
// so the typed-variable expansion has an obvious baseline to extend.
//
// 1. Enable unicorn/prefer-set-has via an expect annotation.
// 2. Call `.includes(x)` on an inline array literal.
// 3. Assert the call expression is reported.
func TestRuleCorpusUnicornPreferSetHas(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/prefer-set-has.ts", "const x = 2;\n// expect: unicorn/prefer-set-has error\nconst found = [1, 2, 3].includes(x);\n")
}
