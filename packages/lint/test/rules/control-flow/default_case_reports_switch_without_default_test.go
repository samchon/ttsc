package linthost

import "testing"

// TestDefaultCaseReportsSwitchWithoutDefault verifies a switch lacking a default clause is reported.
//
// The core rule: a non-empty switch with no `default` clause and no marker
// comment silently drops unmatched discriminants, so ESLint reports on the
// `switch` keyword. Primary positive arm of the fix.
//
// 1. Build a switch with only `case` clauses and no marker.
// 2. Run the engine with default-case enabled.
// 3. Assert exactly one finding at the switch statement (line 2).
//
// @evidence contracts/testing.md#behavioral-verification Engine requires exactly one error at the original switch line two with neither default clause nor marker.
// @evidence contracts/testing.md#independent-expectations The independently authored nonempty switch lacks both supported omission exemptions; line two identifies the switch rather than its single clause.
// @evidence contracts/testing.md#distinguishing-cases Unmarked nonempty switch reports; existing-default, empty-switch and matching-marker tests own each allowed boundary.
// @evidence contracts/testing.md#execution-ownership TestDefaultCaseReportsSwitchWithoutDefault is selected in the shared Go unit population. It calls assertDefaultCaseReportsAtLines and lintDefaultCase, forwarding the actual authored source and option JSON through InlineRuleResolver and Engine.Run. No installed consumer, native artifact build or real product host runs.
func TestDefaultCaseReportsSwitchWithoutDefault(t *testing.T) {
  assertDefaultCaseReportsAtLines(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    break;
}
`, "", 2)
}
