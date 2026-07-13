package linthost

import "testing"

// TestNoFallthroughRejectsDoWhileExitedByUnlabeledContinue verifies a bare continue reaches the do/while test.
//
// `do { continue; } while (a)`: every iteration jumps to the loop test, and
// a false test exits the loop, so the case falls through even though the
// body never completes normally. Locks the unlabeled-continue half of the
// do/while iteration-ends rule (the labeled twin is covered separately).
//
// 1. End a case with `do { continue; } while (a);`.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert exactly one finding at the next case label.
func TestNoFallthroughRejectsDoWhileExitedByUnlabeledContinue(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
declare const a: boolean;
switch (foo) {
  case 0:
    do {
      continue;
    } while (a);
  case 1:
    console.log(1);
    break;
}
`, "", 8)
}
