package linthost

import (
  "strings"
  "testing"
)

// TestUnicornPreferSimpleConditionFirstReportsExactSafeFindingAndStableFix verifies the safe logical reorder preserves exact edits and source.
//
// The independently authored safe conjunction output preserves operands and syntax; full-source equality detects an incorrect but idempotent transform.
//
// 1. Execute the retained logical source variants through the owning Go rule.
// 2. Compare the diagnostic/edit or unchanged result at each stated boundary.
//
// @evidence contracts/testing.md#behavioral-verification Actual rule/fix execution checks one diagnostic, authored operand range and edit, full rewritten source and clean re-lint.
// @evidence contracts/testing.md#independent-expectations The independently authored safe conjunction output preserves operands and syntax; full-source equality detects an incorrect but idempotent transform.
// @evidence contracts/testing.md#distinguishing-cases The original reorder input must change; its exact fixed output must be accepted without another finding.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreferSimpleConditionFirstReportsExactSafeFindingAndStableFix owns the literal logical-expression variants as a discoverable Go unit entry; actual parser/engine/fix operations run in the shared process without a consumer installation, native producer or product child host.
func TestUnicornPreferSimpleConditionFirstReportsExactSafeFindingAndStableFix(t *testing.T) {
  source := `declare const gate: boolean;
declare const ready: boolean;
declare const kind: unknown;
if ((gate ? true : false) && ready && typeof kind === "string") {
  void 0;
}
`
  _, _, findings := runRuleFindingsSnapshot(t, preferSimpleConditionFirstRule, source, nil)
  assertUnicornRuleErrorFindingIdentities(t, preferSimpleConditionFirstRule, findings)
  if len(findings) != 1 {
    t.Fatalf("want one finding, got %d (%+v)", len(findings), findings)
  }
  finding := findings[0]
  ready := strings.LastIndex(source, "ready")
  if finding.Pos != ready || finding.End != ready+len("ready") {
    t.Fatalf("range: want [%d,%d), got [%d,%d)", ready, ready+len("ready"), finding.Pos, finding.End)
  }
  wantMessage := "Prefer this simple condition first in the `&&` expression."
  if finding.Message != wantMessage {
    t.Fatalf("message: want %q, got %q", wantMessage, finding.Message)
  }
  if len(finding.Fix) != 1 {
    t.Fatalf("want one fix edit, got %+v", finding.Fix)
  }
  edit := finding.Fix[0]
  expression := `(gate ? true : false) && ready && typeof kind === "string"`
  start := strings.Index(source, expression)
  if edit.Pos != start || edit.End != start+len(expression) {
    t.Fatalf("edit range: want [%d,%d), got [%d,%d)", start, start+len(expression), edit.Pos, edit.End)
  }
  wantEdit := `ready && (typeof kind === "string") && (gate ? true : false)`
  if edit.Text != wantEdit {
    t.Fatalf("edit text: want %q, got %q", wantEdit, edit.Text)
  }

  expected := strings.Replace(source, expression, wantEdit, 1)
  fixed, count := runFixSnapshot(t, preferSimpleConditionFirstRule, source)
  if count != 1 || fixed != expected {
    t.Fatalf("fix: want count=1 and %q, got count=%d and %q", expected, count, fixed)
  }
  _, _, after := runRuleFindingsSnapshot(t, preferSimpleConditionFirstRule, fixed, nil)
  if len(after) != 0 {
    t.Fatalf("second pass must be idempotent, got %+v", after)
  }
}
