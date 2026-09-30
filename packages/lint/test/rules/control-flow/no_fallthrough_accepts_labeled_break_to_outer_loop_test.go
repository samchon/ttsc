package linthost

import "testing"

// TestNoFallthroughAcceptsLabeledBreakToOuterLoop verifies `break outer` escaping the switch terminates the case.
//
// A labeled break targeting a loop outside the switch leaves the switch
// entirely, so the next case is unreachable. Locks labeled-break escape
// propagation through the nested switch (an unlabeled break would merely
// exit the switch — same verdict here, but the label must not confuse the
// absorption rules).
//
// 1. End a case with `break outer;` where `outer` labels the enclosing loop.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Zero findings when a case breaks to the enclosing outer loop.
// @evidence contracts/testing.md#independent-expectations The authored label encloses the switch; leaving that target cannot reach the next case.
// @evidence contracts/testing.md#distinguishing-cases RejectsLabeledBlockBrokenByOwnLabel targets a block inside the case and reopens completion.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughAcceptsLabeledBreakToOuterLoop is selected in the shared Go unit population and invokes assertNoFallthroughClean and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughAcceptsLabeledBreakToOuterLoop(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
declare const a: boolean;
outer: while (a) {
  switch (foo) {
    case 0:
      console.log(0);
      break outer;
    case 1:
      console.log(1);
  }
}
`, "")
}
