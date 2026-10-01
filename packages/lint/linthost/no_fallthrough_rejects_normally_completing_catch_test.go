package linthost

import "testing"

// TestNoFallthroughRejectsNormallyCompletingCatch verifies a catch that swallows the exception keeps the case falling through.
//
// Upstream invalid case `try { throw 0; } catch (err) {}`: the catch block
// completes normally, so control reaches the case end even though the try
// block always throws. Negative twin of the breaking-catch acceptance, one
// property away (the break removed from catch).
//
// 1. End a case with a throwing try and a normally-completing catch.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert exactly one finding at the next case label.
//
// @evidence contracts/testing.md#behavioral-verification Exactly one no-fallthrough error reports on target line nine after a swallowed throw.
// @evidence contracts/testing.md#independent-expectations The authored explicit throw reaches a catch whose logging completes normally; abrupt try completion alone cannot close this join.
// @evidence contracts/testing.md#distinguishing-cases AcceptsBreakingCatchAfterThrowingTry retains the same reached catch with a terminating break.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughRejectsNormallyCompletingCatch is selected in the shared Go unit population and invokes assertNoFallthroughReportsAtLines and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughRejectsNormallyCompletingCatch(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
switch (foo) {
  case 0:
    try {
      throw new Error("boom");
    } catch {
      console.log("swallowed");
    }
  case 1:
    console.log(1);
    break;
}
`, "", 9)
}
