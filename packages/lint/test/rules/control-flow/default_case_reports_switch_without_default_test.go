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
func TestDefaultCaseReportsSwitchWithoutDefault(t *testing.T) {
  assertDefaultCaseReportsAtLines(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    break;
}
`, "", 2)
}
