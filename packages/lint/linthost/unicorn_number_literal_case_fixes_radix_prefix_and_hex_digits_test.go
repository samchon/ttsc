package linthost

import "testing"

// TestUnicornNumberLiteralCaseFixesRadixPrefixAndHexDigits verifies the rule
// lowercases the radix prefix letter and uppercases hex digits, in every
// mixed-case combination.
//
// The canonical spelling is asymmetric — the prefix goes down, the digits go
// up — so a fixer that simply lowercased or simply uppercased the literal would
// pass half of these and corrupt the other half. Binary and octal digits carry
// no case, which is why only their prefix letter can be wrong.
//
//  1. Declare a const initialized to a radix-prefixed literal whose prefix,
//     digits, or both are in the wrong case.
//  2. Run the rule through the native fix applier.
//  3. Assert the rewritten literal is `0x` + uppercase digits, `0b`, or `0o`.
//
// @evidence contracts/testing.md#behavioral-verification assertFixSnapshot verifies six complete radix-literal rewrites.
// @evidence contracts/testing.md#independent-expectations Literal source/expected pairs specify asymmetric lowercase prefixes and uppercase hex digits independently of the Go normalizer.
// @evidence contracts/testing.md#distinguishing-cases Hex changes cover digits-only, prefix-only, both and mixed digits; binary/octal changes affect only their prefixes. Canonical negatives are TestUnicornNumberLiteralCaseSkipsCanonicalLiterals.
// @evidence contracts/testing.md#execution-ownership TestUnicornNumberLiteralCaseFixesRadixPrefixAndHexDigits is a discoverable Go unit host; its literal fixtures and table cases execute the owning engine/fix operations in the shared Go process without consumer installation, native builds or product children. Helper failures retain each input and expected string.
func TestUnicornNumberLiteralCaseFixesRadixPrefixAndHexDigits(t *testing.T) {
  for _, testCase := range []struct {
    source   string
    expected string
  }{
    {source: "const n = 0xff;\n", expected: "const n = 0xFF;\n"},
    {source: "const n = 0XFF;\n", expected: "const n = 0xFF;\n"},
    {source: "const n = 0Xff;\n", expected: "const n = 0xFF;\n"},
    {source: "const n = 0xFf;\n", expected: "const n = 0xFF;\n"},
    {source: "const n = 0B1010;\n", expected: "const n = 0b1010;\n"},
    {source: "const n = 0O17;\n", expected: "const n = 0o17;\n"},
  } {
    assertFixSnapshot(
      t,
      unicornNumberLiteralCaseRuleName,
      testCase.source,
      testCase.expected,
    )
  }
}
