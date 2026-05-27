package linthost

import "testing"

// TestRuleCorpusUnicornConsistentDateClone verifies the rule fires on
// the redundant-`getTime()` clone shape.
//
// `new Date(other.getTime())` is the canonical wrong shape — the
// fixture exercises both the `Date` callee match and the
// `<x>.getTime()` zero-argument call shape on the new-expression's
// argument.
//
// 1. Enable unicorn/consistent-date-clone.
// 2. Declare `new Date(original.getTime())` against another `Date`.
// 3. Assert the new-expression is reported.
func TestRuleCorpusUnicornConsistentDateClone(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/consistent-date-clone.ts", "const original = new Date();\n// expect: unicorn/consistent-date-clone error\nconst clone = new Date(original.getTime());\nvoid clone;\n")
}
