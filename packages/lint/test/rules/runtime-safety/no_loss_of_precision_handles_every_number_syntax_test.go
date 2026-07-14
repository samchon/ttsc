package linthost

import (
  "strings"
  "testing"
)

// TestNoLossOfPrecisionHandlesEveryNumberSyntax verifies full Number literal coverage.
//
// Precision loss depends on the requested coefficient and the exact IEEE-754
// rounding result, not only on decimal safe-integer bounds. These twins cover
// every JavaScript Number spelling and the boundaries where rounding changes.
//
// 1. Check exact and inexact decimal integers, fractions, and exponents.
// 2. Check binary, octal, hexadecimal, legacy octal, and separator spellings.
// 3. Check rounding ties, coefficient carry, range edges, and exclusions.
func TestNoLossOfPrecisionHandlesEveryNumberSyntax(t *testing.T) {
  tests := []struct {
    name    string
    literal string
    loses   bool
  }{
    {name: "zero", literal: "0", loses: false},
    {name: "fractional zero", literal: "0.0000000000000000000000000000", loses: false},
    {name: "zero with enormous exponent", literal: "0e999999999999999999999999", loses: false},
    {name: "maximum safe integer", literal: "9007199254740991", loses: false},
    {name: "exact two to the fifty third", literal: "9007199254740992", loses: false},
    {name: "inexact two to the fifty third plus one", literal: "9007199254740993", loses: true},
    {name: "exact two to the fifty third plus two", literal: "9007199254740994", loses: false},
    {name: "separated exact decimal", literal: "9_007_199_254_740_992", loses: false},
    {name: "separated inexact decimal", literal: "9_007_199_254_740_993", loses: true},
    {name: "ordinary fraction", literal: "123.456", loses: false},
    {name: "separated exact fraction", literal: "123.4_56", loses: false},
    {name: "rounded fraction", literal: "1.0000000000000001", loses: true},
    {name: "representable adjacent fraction", literal: "1.0000000000000002", loses: false},
    {name: "rounding carry changes magnitude", literal: "9.9999999999999999", loses: true},
    {name: "separated rounded fraction", literal: "1.0_000000000000001", loses: true},
    {name: "leading decimal point", literal: ".42", loses: false},
    {name: "trailing decimal point", literal: "42.", loses: false},
    {name: "ordinary exponent", literal: "123e34", loses: false},
    {name: "separated exact exponent", literal: "12_3e3_4", loses: false},
    {name: "rounded exponent", literal: "9.007199254740993e15", loses: true},
    {name: "separated rounded exponent", literal: "9.0_0719925_474099_3e1_5", loses: true},
    {name: "sign does not change precision", literal: "-9007199254740993", loses: true},
    {name: "exact binary", literal: "0b11111111111111111111111111111111111111111111111111111", loses: false},
    {name: "separated exact binary", literal: "0b111_111_111_111_1111_11111_111_11111_1111111111_11111111_111_111", loses: false},
    {name: "rounded binary", literal: "0b100000000000000000000000000000000000000000000000000001", loses: true},
    {name: "separated rounded binary", literal: "0B1_0000000000000000000000000000000000000000000000000000_1", loses: true},
    {name: "exact octal", literal: "0o377777777777777777", loses: false},
    {name: "separated exact octal", literal: "0o3_77_777_777_777_777_777", loses: false},
    {name: "rounded octal", literal: "0O400000000000000001", loses: true},
    {name: "legacy exact octal", literal: "0377777777777777777", loses: false},
    {name: "legacy rounded octal", literal: "0400000000000000001", loses: true},
    {name: "decimal with legacy-looking prefix", literal: "0195", loses: false},
    {name: "zero hexadecimal", literal: "0x0", loses: false},
    {name: "exact hexadecimal", literal: "0x20000000000000", loses: false},
    {name: "separated exact hexadecimal", literal: "0x2_0000000000000", loses: false},
    {name: "rounded hexadecimal", literal: "0x20000000000001", loses: true},
    {name: "separated rounded hexadecimal", literal: "0X2_0000000000001", loses: true},
    {name: "hexadecimal overflow", literal: "0x1" + strings.Repeat("0", 300), loses: true},
    {name: "largest finite number", literal: "1.7976931348623157e308", loses: false},
    {name: "overflow", literal: "1.7976931348623159e308", loses: true},
    {name: "enormous overflow exponent", literal: "1e999999999999999999999999", loses: true},
    {name: "smallest rounded subnormal", literal: "5e-324", loses: false},
    {name: "precise smallest subnormal", literal: "4.9406564584124654e-324", loses: false},
    {name: "underflow", literal: "1e-324", loses: true},
    {name: "enormous underflow exponent", literal: "1e-999999999999999999999999", loses: true},
    {name: "decimal bigint", literal: "9007199254740993n", loses: false},
    {name: "separated decimal bigint", literal: "9_007_199_254_740_993n", loses: false},
    {name: "hexadecimal bigint", literal: "0x20000000000001n", loses: false},
    {name: "malformed literal", literal: "1e", loses: false},
  }

  for _, test := range tests {
    t.Run(test.name, func(t *testing.T) {
      if actual := numericLiteralLosesPrecision(test.literal); actual != test.loses {
        t.Fatalf("numericLiteralLosesPrecision(%q) = %v, want %v", test.literal, actual, test.loses)
      }
    })
  }

  t.Run("decimal tie rounds upward", func(t *testing.T) {
    coefficient, magnitude := roundFloatToDecimalPrecision(1.25, 2)
    if coefficient != "13" || magnitude != 0 {
      t.Fatalf("roundFloatToDecimalPrecision(1.25, 2) = %se%d, want 13e0", coefficient, magnitude)
    }
  })
}
