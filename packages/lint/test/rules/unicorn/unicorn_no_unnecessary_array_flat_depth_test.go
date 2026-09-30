package linthost

import "testing"

// TestRuleCorpusUnicornNoUnnecessaryArrayFlatDepth verifies
// unicorn/no-unnecessary-array-flat-depth reports `.flat(1)`.
//
// `Array#flat()` defaults to depth 1, so passing the literal `1` is a
// redundant spelling. The rule's NumericLiteral-text check on "1" is the
// only branch, so this minimal positive case pins both the kind check and
// the text comparison.
//
// 1. Enable unicorn/no-unnecessary-array-flat-depth via an expect annotation.
// 2. Call `.flat(1)` on an array literal.
// 3. Assert the call expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies flat explicitly supplies its default depth of one; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-unnecessary-array-flat-depth annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; flat omits the default depth argument. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoUnnecessaryArrayFlatDepth is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoUnnecessaryArrayFlatDepth(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-unnecessary-array-flat-depth.ts", "// expect: unicorn/no-unnecessary-array-flat-depth error\nconst flat = [1, [2]].flat(1);\nvoid flat;\n")
  assertRuleSkipsSource(t, "unicorn/no-unnecessary-array-flat-depth", "const flat = [1,[2]].flat();\n")
}
