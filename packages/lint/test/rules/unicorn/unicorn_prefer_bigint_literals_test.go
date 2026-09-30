package linthost

import "testing"

// TestRuleCorpusUnicornPreferBigintLiterals verifies
// unicorn/prefer-bigint-literals reports a `BigInt(1)` call.
//
// The rule fires when a bare `BigInt` identifier is called with one
// numeric-literal argument (or a digit-only string literal). The fixture
// exercises the numeric-literal branch, which is the canonical
// rewrite case.
//
// 1. Enable unicorn/prefer-bigint-literals via an expect annotation.
// 2. Declare a const initialized to `BigInt(1)`.
// 3. Assert the call expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies BigInt constructs a bigint from a literal numeric value; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-bigint-literals annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; a bigint literal spells that value directly. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferBigintLiterals is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferBigintLiterals(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-bigint-literals.ts", "// expect: unicorn/prefer-bigint-literals error\nconst big = BigInt(1);\n")
  assertRuleSkipsSource(t, "unicorn/prefer-bigint-literals", "const big = 1n;\n")
}
