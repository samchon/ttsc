package linthost

import "testing"

// TestRuleCorpusUnicornNoUnnecessaryArraySpliceCount verifies
// unicorn/no-unnecessary-array-splice-count reports
// `arr.splice(start, arr.length)` whose second argument restates the
// "delete to the end" default.
//
// The rule visits each `CallExpression` with a `splice` / `toSpliced`
// callee and at least two arguments, and reports when the second
// argument is a `.length` property access or the bare `Infinity`
// identifier. The fixture exercises the `.length` form.
//
// 1. Enable unicorn/no-unnecessary-array-splice-count via an expect annotation.
// 2. Call `arr.splice(0, arr.length)` on a local array.
// 3. Assert the second argument is reported.
func TestRuleCorpusUnicornNoUnnecessaryArraySpliceCount(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/no-unnecessary-array-splice-count.ts", "const arr = [1, 2, 3];\n// expect: unicorn/no-unnecessary-array-splice-count error\narr.splice(0, arr.length);\n")
}
