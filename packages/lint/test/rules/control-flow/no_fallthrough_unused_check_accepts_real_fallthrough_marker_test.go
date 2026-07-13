package linthost

import "testing"

// TestNoFallthroughUnusedCheckAcceptsRealFallthroughMarker verifies a marker on a genuine fallthrough is never "unused".
//
// Upstream valid case with reportUnusedFallthroughComment: when the case
// really falls through, the marker is doing its job — neither the
// fallthrough report (suppressed by the marker) nor the unused-comment
// report (the case end is reachable) may fire.
//
// 1. Mark a genuine fallthrough transition.
// 2. Run the engine with options {"reportUnusedFallthroughComment":true}.
// 3. Assert zero findings.
func TestNoFallthroughUnusedCheckAcceptsRealFallthroughMarker(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    // falls through
  case 1:
    console.log(1);
}
`, `{"reportUnusedFallthroughComment":true}`)
}
