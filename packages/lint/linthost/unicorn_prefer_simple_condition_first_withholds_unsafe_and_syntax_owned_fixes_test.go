package linthost

import (
  "testing"
)

// TestUnicornPreferSimpleConditionFirstWithholdsUnsafeAndSyntaxOwnedFixes verifies unsafe order changes remain diagnostic-only.
//
// JavaScript evaluation order, side effects and syntax ownership prevent a blanket swap; the literal warning acknowledges a review requirement without copying the product constant.
//
// 1. Execute the retained logical source variants through the owning Go rule.
// 2. Compare the diagnostic/edit or unchanged result at each stated boundary.
//
// @evidence contracts/testing.md#behavioral-verification Each of eight inputs must produce one ordinary rule error with no edit: calls, member/optional access and a conditional call use the literal review-only message; three real comment positions and a TypeScript-wrapped logical subchain use the literal safe-order message but still withhold the fix.
// @evidence contracts/testing.md#independent-expectations Short-circuit evaluation makes crossed calls and member reads unsafe, while comments and logical assertion wrappers own source text that an automatic partition must not rewrite. The two authored messages distinguish evaluation safety from source-edit eligibility without copying product constants.
// @evidence contracts/testing.md#distinguishing-cases Four evaluation-unsafe inputs and four source-owned inputs all forbid edits, but require different messages; ReportsExactSafeFindingAndStableFix owns the editable counterpart.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreferSimpleConditionFirstWithholdsUnsafeAndSyntaxOwnedFixes owns the literal logical-expression variants as a discoverable Go unit entry; actual parser/engine/fix operations run in the shared process without a consumer installation, native producer or product child host.
func TestUnicornPreferSimpleConditionFirstWithholdsUnsafeAndSyntaxOwnedFixes(t *testing.T) {
  cases := []struct {
    name        string
    expression  string
    safeMessage bool
  }{
    {"call may short circuit", "check() && ready", false},
    {"member access may invoke a getter", "record.enabled && ready", false},
    {"optional access changes evaluation", "record?.enabled && ready", false},
    {"unsafe conditional branch", "(ready ? check() : false) && other", false},
    {"inner comment owns source", "(ready ? true : false) && /* keep */ other", true},
    {"leading comment owns source", "/* keep */ (ready ? true : false) && other", true},
    {"trailing comment owns source", "(ready ? true : false) && other /* keep */", true},
    {"typescript wrapper owns a logical subchain", "(((ready ? true : false) && other) as boolean) && final", true},
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      source := `declare const ready: boolean;
declare const other: boolean;
declare const final: boolean;
declare const record: { enabled?: boolean };
declare function check(): boolean;
if (` + test.expression + `) { void 0; }
`
      _, _, findings := runRuleFindingsSnapshot(t, preferSimpleConditionFirstRule, source, nil)
      assertUnicornRuleErrorFindingIdentities(t, preferSimpleConditionFirstRule, findings)
      if len(findings) != 1 {
        t.Fatalf("want one finding, got %d (%+v)", len(findings), findings)
      }
      finding := findings[0]
      wantMessage := "Consider moving this simple condition first after verifying short-circuit behavior."
      if test.safeMessage {
        wantMessage = "Prefer this simple condition first in the `&&` expression."
      }
      if finding.Message != wantMessage || len(finding.Fix) != 0 {
        t.Fatalf("want %q without fix, got %+v", wantMessage, finding)
      }
    })
  }
}
