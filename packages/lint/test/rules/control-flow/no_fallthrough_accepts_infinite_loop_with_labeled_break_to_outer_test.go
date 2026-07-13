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
