package linthost

import "testing"

// TestRuleCorpusUnicornConsistentExistenceIndexCheck verifies the rule
// fires on the magnitude-comparison existence-check form.
//
// `arr.indexOf(x) >= 0` is the canonical wrong form. Pinning it
// exercises the operator gate (`>=`), the literal-side `0` match, and
// the method-name allowlist for index-returning prototype methods.
//
// 1. Enable unicorn/consistent-existence-index-check.
// 2. Write `arr.indexOf(2) >= 0`.
// 3. Assert the binary expression is reported.
func TestRuleCorpusUnicornConsistentExistenceIndexCheck(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/consistent-existence-index-check.ts", "const arr = [1, 2, 3];\n// expect: unicorn/consistent-existence-index-check error\nconst found = arr.indexOf(2) >= 0;\nvoid found;\n")
}
