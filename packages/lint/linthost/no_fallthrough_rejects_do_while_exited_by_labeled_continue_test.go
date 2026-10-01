package linthost

import "testing"

// TestNoFallthroughRejectsDoWhileExitedByLabeledContinue verifies a labeled continue reaches the do/while test.
//
// `loop: do { continue loop; } while (a)`: the continue ends the iteration,
// the test runs, and a false test exits the loop — so the case falls through.
// If the loop failed to absorb its own labeled continue the body would look
// permanently abrupt and the fallthrough would be missed. Locks the
// labeled-continue absorption path of loopCompletion.
//
// 1. End a case with a labeled do/while whose body continues to its own label.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert exactly one finding at the next case label.
//
// @evidence contracts/testing.md#behavioral-verification Exactly one no-fallthrough error reports on target line eight after self-labeled do-while continue.
// @evidence contracts/testing.md#independent-expectations The authored continue targets its own loop and reaches a possibly false test, making loop exit normally reachable.
// @evidence contracts/testing.md#distinguishing-cases AcceptsContinueTerminatingCase targets an enclosing loop instead and closes the switch path.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughRejectsDoWhileExitedByLabeledContinue is selected in the shared Go unit population and invokes assertNoFallthroughReportsAtLines and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughRejectsDoWhileExitedByLabeledContinue(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
declare const a: boolean;
switch (foo) {
  case 0:
    loop: do {
      continue loop;
    } while (a);
  case 1:
    console.log(1);
    break;
}
`, "", 8)
}
