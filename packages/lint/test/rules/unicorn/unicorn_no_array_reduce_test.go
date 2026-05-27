package linthost

import "testing"

// TestRuleCorpusUnicornNoArrayReduce verifies unicorn/no-array-reduce
// reports a direct `.reduce(...)` call on an array literal.
//
// `reduce` and `reduceRight` share the same method-name branch in the
// rule; the canonical positive case exercises the `reduce` arm and is
// enough to pin the diagnostic against accidental regression of the
// method-name allowlist.
//
// 1. Enable unicorn/no-array-reduce.
// 2. Sum an array literal with `.reduce`.
// 3. Assert the call expression is reported.
func TestRuleCorpusUnicornNoArrayReduce(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/no-array-reduce.ts", "// expect: unicorn/no-array-reduce error\nconst total = [1, 2, 3].reduce((a, b) => a + b, 0);\n")
}
