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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies splice repeats array.length as its deletion count; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-unnecessary-array-splice-count annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; splice omits the redundant full-tail count. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoUnnecessaryArraySpliceCount is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoUnnecessaryArraySpliceCount(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-unnecessary-array-splice-count.ts", "const arr = [1, 2, 3];\n// expect: unicorn/no-unnecessary-array-splice-count error\narr.splice(0, arr.length);\n")
  assertRuleSkipsSource(t, "unicorn/no-unnecessary-array-splice-count", "const arr = [1,2,3]; arr.splice(0);\n")
}
