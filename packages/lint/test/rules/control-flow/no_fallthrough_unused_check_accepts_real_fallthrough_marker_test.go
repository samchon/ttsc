package linthost

import "testing"

// TestNoFallthroughUnusedCheckAcceptsRealFallthroughMarker verifies a marker on a genuine fallthrough is never "unused".
//
// Upstream valid case with reportUnusedFallthroughComment: when the case
// really falls through, the marker is doing its job — neither the
// fallthrough report (suppressed by the marker) nor the unused-comment
// report (the case end is reachable) may fire.
//
// 1. Mark a genuine fallthrough transition.
// 2. Run the engine with options {"reportUnusedFallthroughComment":true}.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Zero findings report for a genuine open transition with unused-marker checking enabled.
// @evidence contracts/testing.md#independent-expectations The authored logging reaches the next clause and its eligible marker documents real supported completion, so neither regular nor unused report applies.
// @evidence contracts/testing.md#distinguishing-cases ReportsUnusedFallthroughComment keeps the marker after a break and reports.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughUnusedCheckAcceptsRealFallthroughMarker is selected in the shared Go unit population and invokes assertNoFallthroughClean and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughUnusedCheckAcceptsRealFallthroughMarker(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    // falls through
  case 1:
    console.log(1);
}
`, `{"reportUnusedFallthroughComment":true}`)
}
