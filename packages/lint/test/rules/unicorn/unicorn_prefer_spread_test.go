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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies Array.from copies an existing array; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-spread annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; spread syntax copies that same array, while Array.from with a mapper stays clean because replacing it with spread would lose the transformation. All three fixtures execute in this entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferSpread is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferSpread(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-spread.ts", "const a = [1, 2, 3];\n// expect: unicorn/prefer-spread error\nconst b = Array.from(a);\n")
  assertRuleSkipsSource(t, "unicorn/prefer-spread", "const a = [1,2,3]; const b = [...a];\n")
  assertRuleSkipsSource(t, "unicorn/prefer-spread", "const a = [1,2,3]; const b = Array.from(a, x => x * 2);\n")
}
