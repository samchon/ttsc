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
