package linthost

import "testing"

// TestNoFallthroughAcceptsInfiniteWhileWithoutBreak verifies `while (true)` with no break terminates the case.
//
// An infinite loop that nothing exits makes the case end unreachable, so no
// break is required before the next label. Locks the constant-true loop-test
// folding of the completion analysis.
//
// 1. End a case with `while (true) { console.log(0); }`.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
func TestNoFallthroughAcceptsInfiniteWhileWithoutBreak(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    while (true) {
      console.log(0);
    }
  case 1:
    console.log(1);
    break;
}
`, "")
}
