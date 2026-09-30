package linthost

import "testing"

// TestNoFallthroughAcceptsInfiniteWhileWithoutBreak verifies `while (true)` with no break terminates the case.
//
// An infinite loop that nothing exits makes the case end unreachable, so no
// break is required before the next label. Locks the constant-true loop-test
// folding of the completion analysis.
//
// 1. End a case with `while (true) { console.log(0); }`.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Zero findings for while true without a reachable break.
// @evidence contracts/testing.md#independent-expectations Literal true establishes the supported infinite-loop condition independently of statement text.
// @evidence contracts/testing.md#distinguishing-cases RejectsInfiniteWhileContainingBreak retains the reachable-break reporting twin.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughAcceptsInfiniteWhileWithoutBreak is selected in the shared Go unit population and invokes assertNoFallthroughClean and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughAcceptsInfiniteWhileWithoutBreak(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    while (true) {
      console.log(0);
    }
  case 1:
    console.log(1);
    break;
}
`, "")
}
