package linthost

import "testing"

// TestRuleCorpusUnicornNoUnreadableArrayDestructuring verifies
// unicorn/no-unreadable-array-destructuring reports a destructuring
// pattern with four leading hole positions before the bound name.
//
// The rule fires when a consecutive run of three or more
// `OmittedExpression` holes is followed by a real element. Four leading
// commas are the canonical worst case from the upstream rule — the
// reader has to count to know which array index `a` reads.
//
// 1. Enable unicorn/no-unreadable-array-destructuring via an expect
//    annotation.
// 2. Destructure `[, , , , a]` out of a 5-element array literal.
// 3. Assert the binding pattern is reported.
func TestRuleCorpusUnicornNoUnreadableArrayDestructuring(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/no-unreadable-array-destructuring.ts", "// expect: unicorn/no-unreadable-array-destructuring error\nconst [, , , , a] = [1, 2, 3, 4, 5];\nvoid a;\n")
}
