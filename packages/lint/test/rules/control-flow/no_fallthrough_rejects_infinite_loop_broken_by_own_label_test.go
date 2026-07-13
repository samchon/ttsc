package linthost

import "testing"

// TestNoFallthroughRejectsInfiniteLoopBrokenByOwnLabel verifies `loop: while (true) { break loop; }` exits the loop.
//
// The labeled break targets the infinite loop itself, so the loop exit is
// reachable and the case falls through — identical to an unlabeled break, but
// exercised through the labeled-statement wrapper. Locks the cooperation
// between labeledCompletion and loopCompletion for self-targeted breaks.
//
// 1. End a case with a labeled infinite loop broken by its own label.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert exactly one finding at the next case label.
func TestNoFallthroughRejectsInfiniteLoopBrokenByOwnLabel(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
switch (foo) {
  case 0:
    loop: while (true) {
      break loop;
    }
  case 1:
    console.log(1);
    break;
}
`, "", 7)
}
