package linthost

import "testing"

// TestRuleCorpusUnicornNoUnnecessarySliceEnd verifies
// unicorn/no-unnecessary-slice-end reports
// `arr.slice(start, arr.length)` whose second argument restates the
// "to the end" default that `slice` already implies.
//
// The rule visits each `CallExpression` with a `slice` callee and
// exactly two arguments, and reports when the second argument is a
// `.length` property access or the bare `Infinity` identifier. The
// fixture exercises the `.length` form.
//
// 1. Enable unicorn/no-unnecessary-slice-end via an expect annotation.
// 2. Call `arr.slice(0, arr.length)` on a local array.
// 3. Assert the second argument is reported.
func TestRuleCorpusUnicornNoUnnecessarySliceEnd(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/no-unnecessary-slice-end.ts", "const arr = [1, 2, 3];\n// expect: unicorn/no-unnecessary-slice-end error\nconst c = arr.slice(0, arr.length);\nvoid c;\n")
}
