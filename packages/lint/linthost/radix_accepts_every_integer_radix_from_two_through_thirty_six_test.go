package linthost

import "testing"

// TestRadixAcceptsEveryIntegerRadixFromTwoThroughThirtySix verifies that radix
// judges a literal radix by the range parseInt accepts, not by a short list of
// bases.
//
// parseInt takes any integer radix from 2 through 36, so base 36 and base 3 are
// as valid as base 10. A radix outside that range, a fraction, a string, a
// boolean, `null` and `undefined` are not.
//
//  1. Run the rule over parseInt calls with radixes 2, 3, 8, 10, 16, 36 and a
//     hexadecimal spelling of 16 and assert nothing is reported.
//  2. Run it over radixes 0, 1, 37, 2.5, "10", true, null and undefined and
//     assert each reports once.
//
// @evidence contracts/testing.md#behavioral-verification radix must accept integer literal radixes from 2 through 36 including non-conventional bases and must report literal radixes that parseInt cannot honor.
// @evidence contracts/testing.md#independent-expectations The ECMAScript specification of parseInt defines the valid radix range as the integers 2 through 36 and treats other values as an unusable radix; the accepted and rejected lists are authored from it.
// @evidence contracts/testing.md#distinguishing-cases The accepted list includes both bounds and non-conventional bases, and the rejected list includes both out-of-range neighbors, a fraction and every non-numeric literal kind, so neither a conventional-bases list nor a bare presence check passes.
// @evidence contracts/testing.md#execution-ownership TestRadixAcceptsEveryIntegerRadixFromTwoThroughThirtySix parses virtual sources and calls the actual engine in the shared Go unit process; no consumer install or native build runs.
func TestRadixAcceptsEveryIntegerRadixFromTwoThroughThirtySix(t *testing.T) {
  for _, radix := range []string{"2", "3", "8", "10", "16", "36", "0x10"} {
    assertRuleSkipsSource(t, "radix", "const n = parseInt(\"z\", "+radix+");\nJSON.stringify(n);\n")
  }
  for _, radix := range []string{"0", "1", "37", "2.5", "\"10\"", "true", "null", "undefined"} {
    source := "const n = parseInt(\"z\", " + radix + ");\nJSON.stringify(n);\n"
    _, _, findings := runRuleFindingsSnapshot(t, "radix", source, nil)
    if len(findings) != 1 {
      t.Fatalf("radix on %q: want exactly one finding, got %d", source, len(findings))
    }
  }
}
