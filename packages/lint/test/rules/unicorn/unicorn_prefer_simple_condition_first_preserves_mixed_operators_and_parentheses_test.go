package linthost

import (
  "testing"
)

// TestUnicornPreferSimpleConditionFirstPreservesMixedOperatorsAndParentheses verifies logical reordering preserves mixed operators and grouping.
//
// JavaScript logical precedence and explicit grouping establish the required retained operators and parentheses independently of the fixer.
//
// 1. Execute the retained logical source variants through the owning Go rule.
// 2. Compare the diagnostic/edit or unchanged result at each stated boundary.
//
// @evidence contracts/testing.md#behavioral-verification Actual engine execution requires one mixed-chain warning and no edit when a grouped OR operand precedes an AND condition.
// @evidence contracts/testing.md#independent-expectations JavaScript precedence makes `(a || b) && c` an `&&` chain whose first operand is a grouped `||`; swapping it ahead of `c` is not claimed safe, so the literal review-only message and the empty fix list are authored in the test rather than derived from the rule.
// @evidence contracts/testing.md#distinguishing-cases The grouped OR operand in an AND chain stays diagnostic-only; ReviewsEachHomogeneousMixedOperatorChain owns a permitted inner-chain edit and its full-source output.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreferSimpleConditionFirstPreservesMixedOperatorsAndParentheses owns the literal logical-expression variants as a discoverable Go unit entry; actual parser/engine/fix operations run in the shared process without a consumer installation, native producer or product child host.
func TestUnicornPreferSimpleConditionFirstPreservesMixedOperatorsAndParentheses(t *testing.T) {
  source := `declare const a: boolean;
declare const b: boolean;
declare const c: boolean;
if ((a || b) && c) { void 0; }
`
  _, _, findings := runRuleFindingsSnapshot(t, preferSimpleConditionFirstRule, source, nil)
  assertUnicornRuleErrorFindingIdentities(t, preferSimpleConditionFirstRule, findings)
  if len(findings) != 1 {
    t.Fatalf("want one outer-chain finding, got %d (%+v)", len(findings), findings)
  }
  if findings[0].Message != "Consider moving this simple condition first after verifying short-circuit behavior." || len(findings[0].Fix) != 0 {
    t.Fatalf("mixed logical operand must remain diagnostic-only, got %+v", findings[0])
  }
}
