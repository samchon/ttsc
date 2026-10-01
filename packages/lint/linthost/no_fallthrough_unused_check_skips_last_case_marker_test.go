package linthost

import "testing"

// TestNoFallthroughUnusedCheckSkipsLastCaseMarker verifies a marker after the last case never reports as unused.
//
// Upstream valid case: the unused-comment check runs per transition, and the
// last case has no next label — a marker before the switch's closing brace
// belongs to no transition, so even with the option on nothing may fire.
//
// 1. Put `break;` then a marker in the switch's only case.
// 2. Run the engine with options {"reportUnusedFallthroughComment":true}.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Zero findings report for a marker after break in the switch's only clause.
// @evidence contracts/testing.md#independent-expectations The authored final clause has no transition target, so its trailing marker cannot belong to an inspected clause pair.
// @evidence contracts/testing.md#distinguishing-cases ReportsUnusedFallthroughComment places a following label after the terminated case.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughUnusedCheckSkipsLastCaseMarker is selected in the shared Go unit population and invokes assertNoFallthroughClean and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughUnusedCheckSkipsLastCaseMarker(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    break;
    // falls through
}
`, `{"reportUnusedFallthroughComment":true}`)
}
