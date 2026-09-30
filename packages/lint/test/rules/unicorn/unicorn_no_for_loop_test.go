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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies an index-only for loop visits array elements; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-for-loop annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; a for-of loop visits the elements directly. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoForLoop is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoForLoop(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-for-loop.ts", "const xs = [1, 2, 3];\n// expect: unicorn/no-for-loop error\nfor (let i = 0; i < xs.length; i++) { void xs[i]; }\n")
  assertRuleSkipsSource(t, "unicorn/no-for-loop", "const xs = [1,2,3]; for (const x of xs) { void x; }\n")
}
