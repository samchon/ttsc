package linthost

import "testing"

// TestNoFallthroughRejectsBreakableConditionalWhile verifies a conditional while loop always offers normal completion.
//
// Upstream invalid case `case 0: while (a) { break; } default:`: the loop
// test may fail before the first iteration, so the case end is reachable no
// matter what the body does. Locks against treating a loop-ending break as a
// case-ending break.
//
// 1. End a case with `while (a) { break; }`.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert exactly one finding at the next case label.
//
// @evidence contracts/testing.md#behavioral-verification Exactly one no-fallthrough error reports on target line eight after a conditional while.
// @evidence contracts/testing.md#independent-expectations An unknown condition may be false at entry, and a loop-local break resumes inside the case rather than leaving the switch.
// @evidence contracts/testing.md#distinguishing-cases AcceptsInfiniteWhileWithoutBreak retains the literal-true, no-exit counterpart.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughRejectsBreakableConditionalWhile is selected in the shared Go unit population and invokes assertNoFallthroughReportsAtLines and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughRejectsBreakableConditionalWhile(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
declare const a: boolean;
switch (foo) {
  case 0:
    while (a) {
      break;
    }
  case 1:
    console.log(1);
    break;
}
`, "", 8)
}
