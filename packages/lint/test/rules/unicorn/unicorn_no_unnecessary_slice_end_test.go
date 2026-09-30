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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies slice repeats the receiver length as its end bound; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-unnecessary-slice-end annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; slice omits the redundant receiver-length bound. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoUnnecessarySliceEnd is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoUnnecessarySliceEnd(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-unnecessary-slice-end.ts", "const arr = [1, 2, 3];\n// expect: unicorn/no-unnecessary-slice-end error\nconst c = arr.slice(0, arr.length);\nvoid c;\n")
  assertRuleSkipsSource(t, "unicorn/no-unnecessary-slice-end", "const arr = [1,2,3]; const c = arr.slice(0);\n")
}
