package linthost

import "testing"

// TestRuleCorpusUnicornPreferSpread verifies the rule reports a
// single-argument `Array.from(x)` call.
//
// The single-argument gate isolates the shallow-copy shape the rule
// replaces with `[...x]`. A `mapFn` second argument would change
// behavior, so the fixture pins the no-mapper form to lock the
// straightforward positive case.
//
// 1. Enable unicorn/prefer-spread via an expect annotation.
// 2. Call `Array.from(a)` with a single iterable argument.
// 3. Assert the call expression is reported.
func TestRuleCorpusUnicornPreferSpread(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/prefer-spread.ts", "const a = [1, 2, 3];\n// expect: unicorn/prefer-spread error\nconst b = Array.from(a);\n")
}
