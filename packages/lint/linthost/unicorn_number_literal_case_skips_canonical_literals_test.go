package linthost

import "testing"

// TestUnicornNumberLiteralCaseSkipsCanonicalLiterals verifies thirteen authored
// canonical or case-free literals stay silent.
//
// Lowercase exponent/radix markers, uppercase hex digits and unchanged
// lowercase bigint suffixes contrast with the corresponding rewrite cases.
// Plain decimal, legacy octal and zero add controls with no case-bearing
// marker to normalize.
//
//  1. Feed the rule a literal in its canonical spelling.
//  2. Assert the engine emits zero findings for it.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleSkipsSource requires zero diagnostics for thirteen authored canonical literals.
// @evidence contracts/testing.md#independent-expectations The literal zero oracle follows the supported canonical case policy, with decimal/legacy-octal forms containing no case-bearing marker.
// @evidence contracts/testing.md#distinguishing-cases Plain decimal, zero, signed/fractional/separated exponents, hex/binary/octal, legacy octal, decimal bigint and separated hex bigint stay clean; rewrite twins are the corresponding Fixes* entries.
// @evidence contracts/testing.md#execution-ownership TestUnicornNumberLiteralCaseSkipsCanonicalLiterals is a discoverable Go unit host; its literal fixtures and table cases execute the owning engine/fix operations in the shared Go process without consumer installation, native builds or product children. Helper failures retain each input and expected string.
func TestUnicornNumberLiteralCaseSkipsCanonicalLiterals(t *testing.T) {
  for _, source := range []string{
    "const n = 123;\n",
    "const n = 0;\n",
    "const n = 1e10;\n",
    "const n = 2e+5;\n",
    "const n = 2e-5;\n",
    "const n = 0.5e3;\n",
    "const n = 1_000e5;\n",
    "const n = 0xFF;\n",
    "const n = 0b1010;\n",
    "const n = 0o17;\n",
    "const n = 0777;\n",
    "const n = 1n;\n",
    "const n = 0xFF_FFn;\n",
  } {
    assertRuleSkipsSource(t, unicornNumberLiteralCaseRuleName, source)
  }
}
