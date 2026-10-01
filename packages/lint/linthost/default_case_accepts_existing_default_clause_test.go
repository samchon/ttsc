package linthost

import "testing"

// TestDefaultCaseAcceptsExistingDefaultClause verifies a present default clause satisfies the rule.
//
// A `switch` that already spells out `default` needs no marker and must never
// report. Negative twin of the missing-default finding, one property away (the
// default clause added).
//
// 1. Build a switch whose clauses include a `default`.
// 2. Run the engine with default-case enabled.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Engine requires zero findings when the original switch contains a default clause.
// @evidence contracts/testing.md#independent-expectations An authored default handles unmatched discriminants, independently satisfying the explicit-default policy without a marker.
// @evidence contracts/testing.md#distinguishing-cases Existing default stays clean; ReportsSwitchWithoutDefault owns the clause-removed positive twin.
// @evidence contracts/testing.md#execution-ownership TestDefaultCaseAcceptsExistingDefaultClause is selected in the shared Go unit population. It calls assertDefaultCaseClean and lintDefaultCase, forwarding the actual authored source and option JSON through InlineRuleResolver and Engine.Run. No installed consumer, native artifact build or real product host runs.
func TestDefaultCaseAcceptsExistingDefaultClause(t *testing.T) {
  assertDefaultCaseClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    break;
  default:
    console.log("other");
}
`, "")
}
