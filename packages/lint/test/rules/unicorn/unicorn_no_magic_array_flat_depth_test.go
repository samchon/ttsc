package linthost

import "testing"

// TestRuleCorpusUnicornNoMagicArrayFlatDepth verifies
// unicorn/no-magic-array-flat-depth reports `.flat(2)` and friends.
//
// The rule fires only for a single NumericLiteral argument whose text is
// neither "1" (default depth) nor `Infinity` (parsed as an Identifier, so the
// kind check exempts it automatically). The fixture uses `2`, the smallest
// magic depth, to pin the positive case.
//
// 1. Enable unicorn/no-magic-array-flat-depth via an expect annotation.
// 2. Call `.flat(2)` on a nested array literal.
// 3. Assert the call expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies flat receives an unexplained numeric depth of two; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-magic-array-flat-depth annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; a named depth retains the same numeric value without a magic argument. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoMagicArrayFlatDepth is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoMagicArrayFlatDepth(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-magic-array-flat-depth.ts", "// expect: unicorn/no-magic-array-flat-depth error\nconst flat = [1, [2, [3]]].flat(2);\nvoid flat;\n")
  assertRuleSkipsSource(t, "unicorn/no-magic-array-flat-depth", "const depth = 2; const flat = [1,[2,[3]]].flat(depth);\n")
}
