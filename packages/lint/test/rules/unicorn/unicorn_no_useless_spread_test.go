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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies an array literal spreads another literal array; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-useless-spread annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; the outer array directly contains the same elements. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoUselessSpread is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoUselessSpread(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-useless-spread.ts", "// expect: unicorn/no-useless-spread error\nconst a = [...[1, 2, 3]];\nvoid a;\n")
  assertRuleSkipsSource(t, "unicorn/no-useless-spread", "const a = [1,2,3];\n")
}
