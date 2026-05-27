package linthost

import "testing"

// TestRuleCorpusUnicornConsistentEmptyArraySpread verifies the rule
// fires when a spread ternary's branches have inconsistent shapes.
//
// The mismatched-branch case — one array literal, one non-array — is
// the canonical wrong shape. Pinning this fixture locks the
// SpreadElement + ConditionalExpression matcher and the XOR between
// the two branches' array-literal status.
//
// 1. Enable unicorn/consistent-empty-array-spread.
// 2. Inside an array literal, spread `cond ? [x] : <non-array>`.
// 3. Assert the spread element is reported.
func TestRuleCorpusUnicornConsistentEmptyArraySpread(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/consistent-empty-array-spread.ts", "declare const cond: boolean;\ndeclare const x: number;\n// expect: unicorn/consistent-empty-array-spread error\nconst a = [1, ...(cond ? [x] : 2 as unknown as number[])];\nvoid a;\n")
}
