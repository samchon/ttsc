package linthost

import (
  "testing"
)

// TestUnicornPreferSimpleConditionFirstReviewsEachHomogeneousMixedOperatorChain verifies each homogeneous chain inside a mixed expression is reviewed.
//
// Operator grouping and authored report/edit expectations independently establish each local chain decision.
//
// 1. Execute the retained logical source variants through the owning Go rule.
// 2. Compare the diagnostic/edit or unchanged result at each stated boundary.
//
// @evidence contracts/testing.md#behavioral-verification NewEngine.Run checks the retained mixed expression for reports at each eligible homogeneous chain, rather than treating the whole tree as one chain.
// @evidence contracts/testing.md#independent-expectations Operator grouping and authored report/edit expectations independently establish each local chain decision.
// @evidence contracts/testing.md#distinguishing-cases Each original homogeneous subchain preserves its own expected report or fix inside the mixed-operator boundary.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreferSimpleConditionFirstReviewsEachHomogeneousMixedOperatorChain owns the literal logical-expression variants as a discoverable Go unit entry; actual parser/engine/fix operations run in the shared process without a consumer installation, native producer or product child host.
func TestUnicornPreferSimpleConditionFirstReviewsEachHomogeneousMixedOperatorChain(t *testing.T) {
  source := `declare const flag: boolean;
declare const ready: boolean;
declare const enabled: boolean;
if (((flag ? true : false) && ready) || enabled) { void 0; }
`
  _, _, findings := runRuleFindingsSnapshot(t, preferSimpleConditionFirstRule, source, nil)
  assertUnicornRuleErrorFindingIdentities(t, preferSimpleConditionFirstRule, findings)
  if len(findings) != 2 {
    t.Fatalf("want inner safe and outer unsafe findings, got %d (%+v)", len(findings), findings)
  }
  safe := 0
  unsafe := 0
  fixes := 0
  for _, finding := range findings {
    switch finding.Message {
    case "Prefer this simple condition first in the `&&` expression.":
      safe++
    case "Consider moving this simple condition first after verifying short-circuit behavior.":
      unsafe++
    default:
      t.Fatalf("unexpected mixed-chain message: %+v", finding)
    }
    fixes += len(finding.Fix)
  }
  if safe != 1 || unsafe != 1 || fixes != 1 {
    t.Fatalf("want one safe fix and one unsafe diagnostic, got safe=%d unsafe=%d fixes=%d", safe, unsafe, fixes)
  }
  expected := `declare const flag: boolean;
declare const ready: boolean;
declare const enabled: boolean;
if ((ready && (flag ? true : false)) || enabled) { void 0; }
`
  fixed, count := runFixSnapshot(t, preferSimpleConditionFirstRule, source)
  if count != 1 || fixed != expected {
    t.Fatalf("mixed-chain fix: want count=1 and %q, got count=%d and %q", expected, count, fixed)
  }
}
