package linthost

import "testing"

// TestRuleCorpusUnicornNoNegatedCondition verifies the rule reports an
// `if (x !== 0) { … } else { … }` with a negated condition.
//
// The matcher fires when the condition uses a `!==` (or `!=` or `!`) operator
// AND the statement has both a then- and an else-branch — inverting and
// swapping the branches reads in source order. This fixture pins the
// `!==` if/else arm.
//
// 1. Enable unicorn/no-negated-condition via an expect annotation.
// 2. Pair `if (x !== 0)` with an `else` branch.
// 3. Assert the if-statement is reported.
func TestRuleCorpusUnicornNoNegatedCondition(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/no-negated-condition.ts", "declare const x: number;\n// expect: unicorn/no-negated-condition error\nif (x !== 0) {\n  void \"nonzero\";\n} else {\n  void \"zero\";\n}\n")
}
