package linthost

import "testing"

// TestNoFallthroughRejectsDoWhileWithBreak verifies a do/while exited by break falls through.
//
// Upstream invalid case `do { break; } while (a);`: the break ends the loop
// and control continues into the next case. Negative twin of the
// always-throwing do/while, one property away (throw replaced by break).
//
// 1. End a case with `do { break; } while (a);`.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert exactly one finding at the next case label.
func TestNoFallthroughRejectsDoWhileWithBreak(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
declare const a: boolean;
switch (foo) {
  case 0:
    do {
      break;
    } while (a);
  case 1:
    console.log(1);
    break;
}
`, "", 8)
}
