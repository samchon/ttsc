package linthost

import "testing"

// TestNoFallthroughRejectsDoWhileExitedByUnlabeledContinue verifies a bare continue reaches the do/while test.
//
// `do { continue; } while (a)`: every iteration jumps to the loop test, and
// a false test exits the loop, so the case falls through even though the
// body never completes normally. Locks the unlabeled-continue half of the
// do/while iteration-ends rule (the labeled twin is covered separately).
//
// 1. End a case with `do { continue; } while (a);`.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert exactly one finding at the next case label.
//
// @evidence contracts/testing.md#behavioral-verification Exactly one no-fallthrough error reports on target line eight after bare do-while continue.
// @evidence contracts/testing.md#independent-expectations Bare continue reaches the current do-while test rather than escaping its enclosing switch; the unknown test permits normal exit.
// @evidence contracts/testing.md#distinguishing-cases The labeled twin verifies identical loop-local absorption while outer-loop continue acceptance stays clean.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughRejectsDoWhileExitedByUnlabeledContinue is selected in the shared Go unit population and invokes assertNoFallthroughReportsAtLines and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughRejectsDoWhileExitedByUnlabeledContinue(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
declare const a: boolean;
switch (foo) {
  case 0:
    do {
      continue;
    } while (a);
  case 1:
    console.log(1);
    break;
}
`, "", 8)
}
