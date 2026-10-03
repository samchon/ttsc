package linthost

import "testing"

// TestRadixAcceptsEveryIntegerRadixFromTwoThroughThirtySix verifies that radix
// judges an explicit literal radix by the lint policy, not by a short list of
// bases.
//
// The lint policy requires a numeric integer literal from 2 through 36, so base 36 and base 3 are
// accepted like base 10. A radix outside that range, a fraction, a string, a
// boolean, `null` and `undefined` are reported even when parseInt could coerce or infer a radix.
//
//  1. Run the rule over parseInt calls with radixes 2, 3, 8, 10, 16, 36 and a
//     hexadecimal spelling of 16 and assert nothing is reported.
//  2. Run it over radixes 0, 1, 37, 2.5, "10", true, null and undefined and
//     assert each reports once.
//
// @evidence contracts/testing.md#behavioral-verification radix accepts the authored numeric integer radixes within 2 through 36, including non-conventional bases, and reports the authored out-of-range, fractional, non-numeric and undefined arguments under its explicit-radix lint policy.
// @evidence contracts/testing.md#independent-expectations ESLint 9.39.2 radix.js isValidRadix admits only numeric integer literal values 2 through 36 and rejects undefined. The authored lists specify that lint policy; ECMAScript parseInt first applies ToInt32 and permits a zero inference path, so these findings do not certify runtime rejection.
// @evidence contracts/testing.md#distinguishing-cases The accepted list includes both bounds and non-conventional bases, and the rejected list includes both out-of-range neighbors, a fraction and authored string, boolean, null and undefined arguments, so neither a conventional-bases list nor a bare presence check passes.
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
