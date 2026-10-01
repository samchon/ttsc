package linthost

import "testing"

// TestNoFallthroughAcceptsDoWhileWithAlwaysThrowingBody verifies a do/while whose body always throws terminates the case.
//
// Upstream valid case `do { throw 0; } while (a);`: the body runs at least
// once and never completes an iteration, so the loop test (and everything
// after the loop) is unreachable. Locks the body-runs-first rule of the
// do/while branch.
//
// 1. End a case with `do { throw ...; } while (a);`.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Zero findings for a do-while whose first body execution throws.
// @evidence contracts/testing.md#independent-expectations Do-while enters its body before testing the condition; the unconditional throw independently closes every case path.
// @evidence contracts/testing.md#distinguishing-cases RejectsForOfWithAlwaysThrowingBody retains the zero-iteration counterpart.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughAcceptsDoWhileWithAlwaysThrowingBody is selected in the shared Go unit population and invokes assertNoFallthroughClean and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughAcceptsDoWhileWithAlwaysThrowingBody(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
declare const a: boolean;
switch (foo) {
  case 0:
    do {
      throw new Error("boom");
    } while (a);
  case 1:
    console.log(1);
    break;
}
`, "")
}
