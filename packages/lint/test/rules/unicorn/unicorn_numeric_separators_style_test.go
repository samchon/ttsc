package linthost

import "testing"

// TestRuleCorpusUnicornNumericSeparatorsStyle verifies the rule reports a
// numeric literal whose `_` grouping is non-canonical.
//
// Canonical decimal grouping is `^[0-9]{1,3}(_[0-9]{3})*$`. `1_2345`
// fails — the rightmost group is four digits and the leading group is
// one digit — so the literal pins the failing-regex branch the MVP
// implementation relies on.
//
// 1. Enable unicorn/numeric-separators-style via an expect annotation.
// 2. Declare a const initialized to `1_2345`.
// 3. Assert the literal is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies the separator splits decimal digits into an inconsistent group; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/numeric-separators-style annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; the separator groups the same five decimal digits as 12_345. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNumericSeparatorsStyle is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNumericSeparatorsStyle(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/numeric-separators-style.ts", "// expect: unicorn/numeric-separators-style error\nconst big = 1_2345;\n")
  assertRuleSkipsSource(t, "unicorn/numeric-separators-style", "const big = 12_345;\n")
}
