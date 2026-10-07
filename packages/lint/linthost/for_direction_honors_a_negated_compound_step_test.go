package linthost

import "testing"

// TestForDirectionHonorsANegatedCompoundStep verifies that for-direction reads
// the sign of a compound step, so `i += -1` counts down and `i -= -1` counts up.
//
// A step written with a negated operand moves the counter opposite to its
// operator, so judging only the operator reports loops that terminate and
// misses loops that do not.
//
//  1. Run the rule over loops that count down with `+= -1` and up with `-= -1`
//     against matching conditions, and assert nothing is reported.
//  2. Run it over loops whose negated step moves away from the condition and
//     assert each reports once.
//
// @evidence contracts/testing.md#behavioral-verification for-direction must accept compound steps whose negated operand moves toward the bound and must report the ones that move away from it.
// @evidence contracts/testing.md#independent-expectations Arithmetic decides the expectations: adding a negative number decreases the counter and subtracting one increases it, so the loop terminates only when that direction matches the comparison.
// @evidence contracts/testing.md#distinguishing-cases Each accepted loop has a rejected twin that differs only in the sign of the operand, so a rule that read only the operator fails one of the pair.
// @evidence contracts/testing.md#execution-ownership TestForDirectionHonorsANegatedCompoundStep parses virtual sources and calls the actual engine in the shared Go unit process; no consumer install or native build runs.
func TestForDirectionHonorsANegatedCompoundStep(t *testing.T) {
  for _, source := range []string{
    "for (let i = 10; i > 0; i += -1) { JSON.stringify(i); }\n",
    "for (let i = 0; i < 10; i -= -1) { JSON.stringify(i); }\n",
  } {
    assertRuleSkipsSource(t, "for-direction", source)
  }
  for _, source := range []string{
    "for (let i = 10; i > 0; i -= -1) { JSON.stringify(i); }\n",
    "for (let i = 0; i < 10; i += -1) { JSON.stringify(i); }\n",
  } {
    _, _, findings := runRuleFindingsSnapshot(t, "for-direction", source, nil)
    if len(findings) != 1 {
      t.Fatalf("for-direction on %q: want exactly one finding, got %d", source, len(findings))
    }
  }
}
