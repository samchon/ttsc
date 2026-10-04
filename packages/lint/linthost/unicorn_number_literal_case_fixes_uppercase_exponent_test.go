package linthost

import "testing"

// TestUnicornNumberLiteralCaseFixesUppercaseExponent verifies the rule reports
// a decimal literal spelled with an uppercase exponent and rewrites it to the
// authored lowercase e spelling.
//
// Each authored case changes only the exponent marker while leaving the
// mantissa, exponent sign and numeric separator byte-identical. Touching a
// digit or sign would fail the independent full-source expected output.
//
//  1. Declare a const whose initializer carries an uppercase exponent
//     (bare, signed, fractional, leading-dot, separated, `0`-leading).
//  2. Run the rule through the native fix applier.
//  3. Assert the rewritten source equals the authored canonical spelling.
//
// @evidence contracts/testing.md#behavioral-verification assertFixSnapshot verifies seven uppercase decimal-exponent rewrites.
// @evidence contracts/testing.md#independent-expectations The authored whole-source pairs specify e-only normalization and retain mantissa, exponent sign and separator bytes.
// @evidence contracts/testing.md#distinguishing-cases Bare/positive/negative exponents, fractional and leading-dot mantissas, separators and zero-leading exponents change.
// @evidence contracts/testing.md#execution-ownership TestUnicornNumberLiteralCaseFixesUppercaseExponent is a discoverable Go unit host; its literal fixtures and table cases execute the owning engine/fix operations in the shared Go process without consumer installation, native builds or product children. Helper failures retain each input and expected string.
func TestUnicornNumberLiteralCaseFixesUppercaseExponent(t *testing.T) {
  for _, testCase := range []struct {
    source   string
    expected string
  }{
    {source: "const n = 1E10;\n", expected: "const n = 1e10;\n"},
    {source: "const n = 2E+5;\n", expected: "const n = 2e+5;\n"},
    {source: "const n = 2E-5;\n", expected: "const n = 2e-5;\n"},
    {source: "const n = 0.5E3;\n", expected: "const n = 0.5e3;\n"},
    {source: "const n = .5E3;\n", expected: "const n = .5e3;\n"},
    {source: "const n = 1_000E5;\n", expected: "const n = 1_000e5;\n"},
    {source: "const n = 0E0;\n", expected: "const n = 0e0;\n"},
  } {
    assertFixSnapshot(
      t,
      unicornNumberLiteralCaseRuleName,
      testCase.source,
      testCase.expected,
    )
  }
}
