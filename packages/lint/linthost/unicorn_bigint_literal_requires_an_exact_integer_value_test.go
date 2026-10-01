package linthost

import "testing"

// TestUnicornBigintLiteralRequiresAnExactIntegerValue verifies numeric BigInt advice requires an exactly represented integer.
//
// Fractional numbers throw during BigInt conversion. Unsafe decimal integers can already be rounded before conversion, unlike bigint source literals.
//
// 1. Run the owning rule on the authored load-bearing arguments.
// 2. Require zero findings on those inputs.
// 3. Preserve report-only diagnostics for the adjacent ordinary idioms.
//
// @evidence contracts/testing.md#behavioral-verification Engine runs unicorn/prefer-bigint-literals; zero-finding negatives distinguish the named argument boundary and report-only positives require activation without automatic edits.
// @evidence contracts/testing.md#independent-expectations Fractional numbers throw during BigInt conversion. Unsafe decimal integers can already be rounded before conversion, unlike bigint source literals.
// @evidence contracts/testing.md#distinguishing-cases Fractions and unsafe Number operands are excluded; exponent Number syntax and arbitrary-precision or signed decimal integer strings retain report-only advice.
// @evidence contracts/testing.md#execution-ownership This discoverable Go unit uses the owning Engine and shared finding helpers in process without installation or a native host.
func TestUnicornBigintLiteralRequiresAnExactIntegerValue(t *testing.T) {
  for _, source := range []string{
    "const value = BigInt(1.5);",
    "const value = BigInt(9007199254740993);",
    "const value = BigInt(9007199254740992);",
    "const value = BigInt('1.5');",
  } {
    t.Run(source, func(t *testing.T) { assertRuleSkipsSource(t, "unicorn/prefer-bigint-literals", source) })
  }
  for _, source := range []string{
    "const value = BigInt(1);",
    "const value = BigInt(1e3);",
    "const value = BigInt('9007199254740993');",
    "const value = BigInt('+01');",
  } {
    t.Run(source, func(t *testing.T) { assertReportOnlySnapshot(t, "unicorn/prefer-bigint-literals", source) })
  }
}

