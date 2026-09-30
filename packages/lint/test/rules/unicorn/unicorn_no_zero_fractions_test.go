package linthost

import "testing"

// TestRuleCorpusUnicornNoZeroFractions verifies unicorn/no-zero-fractions
// reports a numeric literal with a redundant `.0` fraction.
//
// The parser normalizes `.Text` (it drops trailing zeros and trailing
// dots), so the rule has to read raw source via `nodeText`. This fixture
// pins the most common shape, `1.0`, so the raw-text path stays covered.
//
// 1. Enable unicorn/no-zero-fractions via an expect annotation.
// 2. Declare a const initialized to `1.0`.
// 3. Assert the literal is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies a numeric literal has a redundant zero fractional suffix; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-zero-fractions annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; the integer literal omits the zero fractional suffix. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoZeroFractions is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoZeroFractions(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-zero-fractions.ts", "// expect: unicorn/no-zero-fractions error\nconst n = 1.0;\n")
  assertRuleSkipsSource(t, "unicorn/no-zero-fractions", "const n = 1;\n")
}
