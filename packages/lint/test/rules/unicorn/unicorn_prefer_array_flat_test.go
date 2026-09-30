package linthost

import "testing"

// TestRuleCorpusUnicornPreferArrayFlat verifies the rule reports the
// canonical `[].concat(arr1, arr2)` flatten idiom.
//
// The empty-array-receiver gate is the only thing that separates the
// flatten idiom from ordinary `.concat()` usage; the positive case here
// pins that gate plus the at-least-one-argument requirement.
//
// 1. Enable unicorn/prefer-array-flat.
// 2. Flatten two array literals with `[].concat(...)`.
// 3. Assert the call expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies concat starts from an empty array solely to flatten its arguments; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-array-flat annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; flat expresses flattening directly. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferArrayFlat is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferArrayFlat(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-array-flat.ts", "// expect: unicorn/prefer-array-flat error\nconst flat = [].concat([1, 2], [3, 4]);\n")
  assertRuleSkipsSource(t, "unicorn/prefer-array-flat", "const flat = [[1,2],[3,4]].flat();\n")
}
