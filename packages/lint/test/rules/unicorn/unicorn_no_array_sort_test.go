package linthost

import "testing"

// TestRuleCorpusUnicornNoArraySort verifies unicorn/no-array-sort reports
// a zero-argument `.sort()` call on an array literal.
//
// `sort` accepts an optional comparator (zero or one arg); the canonical
// no-comparator shape pins the diagnostic and exercises the upper-bound
// argument guard's lower branch without introducing comparator-shape
// noise.
//
// 1. Enable unicorn/no-array-sort.
// 2. Call `.sort()` on an inline array literal.
// 3. Assert the call expression is reported.
func TestRuleCorpusUnicornNoArraySort(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-array-sort.ts", "// expect: unicorn/no-array-sort error\nconst s = [3, 1, 2].sort();\n")
}
