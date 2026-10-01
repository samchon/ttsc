package linthost

import "testing"

// TestNoFallthroughAcceptsInfiniteLoopWithLabeledBreakToOuter verifies a labeled break past the infinite loop does not reopen it.
//
// `while (true) { break outer; }` never reaches the loop's own exit: the only
// break targets a loop outside the switch, so the case end stays unreachable.
// Negative twin of the self-targeted labeled break — the same break statement
// with a label one scope further out flips the verdict. Locks the
// label-matching in loopCompletion's exit detection.
//
// 1. End a case with an infinite loop whose only break targets the outer loop.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Zero findings when an inner infinite loop breaks to an enclosing outer loop.
// @evidence contracts/testing.md#independent-expectations The explicit outer label lies beyond the switch, so that break cannot become an inner-loop normal exit.
// @evidence contracts/testing.md#distinguishing-cases RejectsInfiniteLoopBrokenByOwnLabel changes only the target ownership and reports.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughAcceptsInfiniteLoopWithLabeledBreakToOuter is selected in the shared Go unit population and invokes assertNoFallthroughClean and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughAcceptsInfiniteLoopWithLabeledBreakToOuter(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
declare const a: boolean;
outer: while (a) {
  switch (foo) {
    case 0:
      while (true) {
        break outer;
      }
    case 1:
      console.log(1);
  }
}
`, "")
}
