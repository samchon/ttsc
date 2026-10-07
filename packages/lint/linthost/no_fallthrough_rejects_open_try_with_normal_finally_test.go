package linthost

import "testing"

// TestNoFallthroughRejectsOpenTryWithNormalFinally verifies a try/finally where both blocks complete normally still falls through.
//
// Negative twin of the terminating-finally acceptance, one property away (the
// break removed from finally): nothing exits, so the case end stays reachable.
// Locks against treating every try statement as terminating (a forbidden
// shortcut in issue #411).
//
// 1. End a case with a try/finally that only logs.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert exactly one finding at the next case label.
//
// @evidence contracts/testing.md#behavioral-verification Exactly one no-fallthrough error reports on target line nine after try and finally both log.
// @evidence contracts/testing.md#independent-expectations Both independently authored blocks complete normally; presence of try/finally alone does not imply termination.
// @evidence contracts/testing.md#distinguishing-cases AcceptsTerminatingFinally adds the unconditional finalizer break and stays clean.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughRejectsOpenTryWithNormalFinally is selected in the shared Go unit population and invokes assertNoFallthroughReportsAtLines and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughRejectsOpenTryWithNormalFinally(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
switch (foo) {
  case 0:
    try {
      console.log(0);
    } finally {
      console.log("cleanup");
    }
  case 1:
    console.log(1);
    break;
}
`, "", 9)
}
