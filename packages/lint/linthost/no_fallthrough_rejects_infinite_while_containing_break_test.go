package linthost

import "testing"

// TestNoFallthroughRejectsInfiniteWhileContainingBreak verifies a break inside `while (true)` reopens the loop exit.
//
// Negative twin of the infinite-while acceptance, one property away (a break
// added): the break targets the loop, so control can resume after it and fall
// into the next case. Locks the break-absorption rule that distinguishes
// loop-targeted breaks from switch-targeted breaks.
//
// 1. End a case with `while (true) { break; }`.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert exactly one finding at the next case label.
//
// @evidence contracts/testing.md#behavioral-verification Exactly one no-fallthrough error reports on target line seven after a reachable inner-loop break.
// @evidence contracts/testing.md#independent-expectations Literal true alone does not guarantee non-completion when the body has a reachable break consumed by that loop.
// @evidence contracts/testing.md#distinguishing-cases AcceptsInfiniteWhileWithoutBreak and IgnoresUnreachableBreakInInfiniteLoop retain both clean boundaries.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughRejectsInfiniteWhileContainingBreak is selected in the shared Go unit population and invokes assertNoFallthroughReportsAtLines and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughRejectsInfiniteWhileContainingBreak(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
switch (foo) {
  case 0:
    while (true) {
      break;
    }
  case 1:
    console.log(1);
    break;
}
`, "", 7)
}
