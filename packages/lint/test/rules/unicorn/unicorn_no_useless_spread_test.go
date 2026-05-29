package linthost

import "testing"

// TestRuleCorpusUnicornNoUselessSpread verifies unicorn/no-useless-spread
// reports `[...[1, 2, 3]]`.
//
// The rule pins both literal kinds with a conservative single-element
// shape; the array case is the more common offender and is enough to
// exercise the SpreadElement branch of the dispatcher.
//
// 1. Enable unicorn/no-useless-spread via an expect annotation.
// 2. Wrap an array literal in another array spread.
// 3. Assert the outer array literal is reported.
func TestRuleCorpusUnicornNoUselessSpread(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-useless-spread.ts", "// expect: unicorn/no-useless-spread error\nconst a = [...[1, 2, 3]];\nvoid a;\n")
}
