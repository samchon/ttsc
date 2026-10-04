package linthost

import "testing"

// TestUnicornNumberLiteralCaseFixesBigintAndSeparatedLiterals verifies the
// BigInt `n` suffix and ES2021 numeric separators survive the fix untouched.
//
// The suffix is the trap: JavaScript accepts only a lowercase `n`, so a fixer
// that uppercased the whole hex tail would emit `0xFFN` and turn valid source
// into a syntax error. The authored outputs canonicalize the number part
// while retaining the suffix; the `_` separators must likewise pass
// through as literal bytes rather than be treated as digits.
//
//  1. Declare a const initialized to a mis-cased BigInt or separated literal.
//  2. Run the rule through the shared Go disk-backed fix applier.
//  3. Assert the digits are canonical while `n` stays lowercase and every `_`
//     stays exactly where it was.
//
// @evidence contracts/testing.md#behavioral-verification assertFixSnapshot verifies seven bigint/separator rewrites without damaging valid suffix or grouping.
// @evidence contracts/testing.md#independent-expectations The authored full-source outputs encode lowercase n, unchanged underscores, lowercase radix prefixes and uppercase hex digits.
// @evidence contracts/testing.md#distinguishing-cases Hex bigint including e-as-digit, binary bigint, octal bigint and separated bigint change; a separated ordinary hex changes only its prefix.
// @evidence contracts/testing.md#execution-ownership TestUnicornNumberLiteralCaseFixesBigintAndSeparatedLiterals is a discoverable Go unit host; its literal fixtures and table cases execute the owning engine/fix operations in the shared Go process without consumer installation, native builds or product children. Helper failures retain each input and expected string.
func TestUnicornNumberLiteralCaseFixesBigintAndSeparatedLiterals(t *testing.T) {
  for _, testCase := range []struct {
    source   string
    expected string
  }{
    {source: "const n = 0XFFn;\n", expected: "const n = 0xFFn;\n"},
    {source: "const n = 0xffn;\n", expected: "const n = 0xFFn;\n"},
    {source: "const n = 0xen;\n", expected: "const n = 0xEn;\n"},
    {source: "const n = 0B1010n;\n", expected: "const n = 0b1010n;\n"},
    {source: "const n = 0O17n;\n", expected: "const n = 0o17n;\n"},
    {source: "const n = 0xff_ffn;\n", expected: "const n = 0xFF_FFn;\n"},
    {source: "const n = 0XFF_FF;\n", expected: "const n = 0xFF_FF;\n"},
  } {
    assertFixSnapshot(
      t,
      unicornNumberLiteralCaseRuleName,
      testCase.source,
      testCase.expected,
    )
  }
}
