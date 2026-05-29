package linthost

import "testing"

// TestRuleCorpusUnicornNoForLoop verifies unicorn/no-for-loop reports a
// classic `for (let i = 0; i < arr.length; i++)` loop.
//
// All three shape arms must align — initializer (`let i = 0`), condition
// (`i < something`), and incrementor (`i++`) — for the rule to fire. The
// fixture exercises the canonical positive case so a regression in any of
// the three arms surfaces here.
//
// 1. Enable unicorn/no-for-loop via an expect annotation.
// 2. Declare an array and walk it with the classic index-based loop.
// 3. Assert the for statement is reported.
func TestRuleCorpusUnicornNoForLoop(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-for-loop.ts", "const xs = [1, 2, 3];\n// expect: unicorn/no-for-loop error\nfor (let i = 0; i < xs.length; i++) { void xs[i]; }\n")
}
