package linthost

import "testing"

// TestNoFallthroughAcceptsInfiniteForWithoutBreak verifies `for (;;)` with no break terminates the case.
//
// A for statement without a condition never exits normally, so the case end
// is unreachable. Locks the missing-condition-means-infinite rule of the for
// branch.
//
// 1. End a case with `for (;;) { console.log(0); }`.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Zero findings for a conditionless for loop without a reachable break.
// @evidence contracts/testing.md#independent-expectations The authored missing condition and absence of loop exits close normal case completion.
// @evidence contracts/testing.md#distinguishing-cases RejectsInfiniteWhileContainingBreak supplies a reachable loop-exit counterpart.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughAcceptsInfiniteForWithoutBreak is selected in the shared Go unit population and invokes assertNoFallthroughClean and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughAcceptsInfiniteForWithoutBreak(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    for (;;) {
      console.log(0);
    }
  case 1:
    console.log(1);
    break;
}
`, "")
}
