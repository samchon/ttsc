package linthost

import "testing"

// TestNoFallthroughReportsEachUnmarkedTransitionOnce verifies one report per falling transition, at the target label.
//
// Issue #411's acceptance criteria pin the reporting shape: a real unmarked
// reachable fallthrough reports exactly once, at the case label it falls
// into. Two consecutive unmarked fallthroughs must yield exactly two
// findings, one per target, with no duplicates.
//
// 1. Chain three cases where the first two fall through unmarked.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert exactly two findings at the second and third labels.
//
// @evidence contracts/testing.md#behavioral-verification Exactly two no-fallthrough errors report on authored target lines five and seven.
// @evidence contracts/testing.md#independent-expectations Three consecutive clauses contain exactly two open transitions; the literal line list independently detects duplicates or skipped pairs.
// @evidence contracts/testing.md#distinguishing-cases NeverReportsLastOpenCase retains the no-next-label boundary and marker cases retain explicit suppression.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughReportsEachUnmarkedTransitionOnce is selected in the shared Go unit population and invokes assertNoFallthroughReportsAtLines and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughReportsEachUnmarkedTransitionOnce(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
  case 1:
    console.log(1);
  case 2:
    console.log(2);
    break;
}
`, "", 5, 7)
}
