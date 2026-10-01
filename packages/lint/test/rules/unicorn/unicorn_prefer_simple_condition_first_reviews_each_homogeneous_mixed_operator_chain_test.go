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
// @evidence contracts/testing.md#behavioral-verification The rule runs over `((flag ? true : false) && ready) || enabled` and must yield exactly two error findings, one safe `&&` finding and one review-only finding, with exactly one fix edit in total; the fix pipeline must then rewrite the file to the authored full source.
// @evidence contracts/testing.md#independent-expectations Operator grouping makes the inner `&&` chain and the outer `||` chain separate decisions; the two literal messages, the counts and the authored fixed source express that expectation independently of the rule.
// @evidence contracts/testing.md#distinguishing-cases The inner chain is reordered safely while the outer chain is reported without a fix, so neither a single whole-tree chain nor a dropped subchain would match.
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
