package linthost

import "testing"

// TestNoFallthroughReportsEachUnmarkedTransitionOnce verifies one report per falling transition, at the target label.
//
// Issue #411's acceptance criteria pin the reporting shape: a real unmarked
// reachable fallthrough reports exactly once, at the case label it falls
// into. Two consecutive unmarked fallthroughs must yield exactly two
// findings, one per target, with no duplicates.
//
// 1. Chain three cases where the first two fall through unmarked.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert exactly two findings at the second and third labels.
func TestNoFallthroughReportsEachUnmarkedTransitionOnce(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
  case 1:
    console.log(1);
  case 2:
    console.log(2);
    break;
}
`, "", 5, 7)
}
