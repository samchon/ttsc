package linthost

import "testing"

// TestNoFallthroughRejectsDoWhileWithBreak verifies a do/while exited by break falls through.
//
// Upstream invalid case `do { break; } while (a);`: the break ends the loop
// and control continues into the next case. Negative twin of the
// always-throwing do/while, one property away (throw replaced by break).
//
// 1. End a case with `do { break; } while (a);`.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert exactly one finding at the next case label.
//
// @evidence contracts/testing.md#behavioral-verification Exactly one no-fallthrough error reports on target line eight after a do-while break.
// @evidence contracts/testing.md#independent-expectations The authored break exits the inner loop and resumes within the case, unlike an unconditional body throw.
// @evidence contracts/testing.md#distinguishing-cases AcceptsDoWhileWithAlwaysThrowingBody retains the abrupt-body counterpart.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughRejectsDoWhileWithBreak is selected in the shared Go unit population and invokes assertNoFallthroughReportsAtLines and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughRejectsDoWhileWithBreak(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
declare const a: boolean;
switch (foo) {
  case 0:
    do {
      break;
    } while (a);
  case 1:
    console.log(1);
    break;
}
`, "", 8)
}
