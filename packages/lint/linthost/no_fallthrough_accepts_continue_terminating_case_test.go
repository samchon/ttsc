package linthost

import "testing"

// TestNoFallthroughAcceptsContinueTerminatingCase verifies a continue targeting an enclosing loop terminates the case.
//
// Upstream valid case `while (a) { switch (foo) { case 0: a(); continue;
// case 1: b(); } }`: the continue leaves the switch for the loop's next
// iteration, so the next case is unreachable. Locks the continue branch of
// the completion analysis.
//
// 1. End a case with a bare `continue;` inside a loop-wrapped switch.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Zero findings for continue leaving a switch inside an enclosing loop.
// @evidence contracts/testing.md#independent-expectations The authored continue targets the loop iteration, making the next switch clause unreachable on that path.
// @evidence contracts/testing.md#distinguishing-cases Do-while continue rejection twins consume a loop-local continue and can reach their following clause.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughAcceptsContinueTerminatingCase is selected in the shared Go unit population and invokes assertNoFallthroughClean and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughAcceptsContinueTerminatingCase(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
declare const a: boolean;
while (a) {
  switch (foo) {
    case 0:
      console.log(0);
      continue;
    case 1:
      console.log(1);
  }
}
`, "")
}
