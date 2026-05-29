package linthost

import "testing"

// TestRuleCorpusUnicornNoArrayReverse verifies unicorn/no-array-reverse
// reports a zero-argument `.reverse()` call on an array literal.
//
// The rule matches the method name plus an empty argument list — the
// shape that maps cleanly onto `Array#toReversed()`. This fixture pins
// that exact positive case so the zero-args guard isn't loosened by
// accident in later refactors.
//
// 1. Enable unicorn/no-array-reverse.
// 2. Call `.reverse()` on an inline array literal.
// 3. Assert the call expression is reported.
func TestRuleCorpusUnicornNoArrayReverse(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-array-reverse.ts", "// expect: unicorn/no-array-reverse error\nconst r = [1, 2, 3].reverse();\n")
}
