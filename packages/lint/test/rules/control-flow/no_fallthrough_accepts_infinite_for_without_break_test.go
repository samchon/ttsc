package linthost

import "testing"

// TestNoFallthroughAcceptsInfiniteForWithoutBreak verifies `for (;;)` with no break terminates the case.
//
// A for statement without a condition never exits normally, so the case end
// is unreachable. Locks the missing-condition-means-infinite rule of the for
// branch.
//
// 1. End a case with `for (;;) { console.log(0); }`.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
func TestNoFallthroughAcceptsInfiniteForWithoutBreak(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    for (;;) {
      console.log(0);
    }
  case 1:
    console.log(1);
    break;
}
`, "")
}
