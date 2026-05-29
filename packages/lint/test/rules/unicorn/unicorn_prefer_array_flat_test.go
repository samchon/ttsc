package linthost

import "testing"

// TestRuleCorpusUnicornPreferArrayFlat verifies the rule reports the
// canonical `[].concat(arr1, arr2)` flatten idiom.
//
// The empty-array-receiver gate is the only thing that separates the
// flatten idiom from ordinary `.concat()` usage; the positive case here
// pins that gate plus the at-least-one-argument requirement.
//
// 1. Enable unicorn/prefer-array-flat.
// 2. Flatten two array literals with `[].concat(...)`.
// 3. Assert the call expression is reported.
func TestRuleCorpusUnicornPreferArrayFlat(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-array-flat.ts", "// expect: unicorn/prefer-array-flat error\nconst flat = [].concat([1, 2], [3, 4]);\n")
}
