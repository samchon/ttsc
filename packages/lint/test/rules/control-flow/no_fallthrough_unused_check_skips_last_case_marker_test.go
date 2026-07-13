package linthost

import "testing"

// TestNoFallthroughUnusedCheckSkipsLastCaseMarker verifies a marker after the last case never reports as unused.
//
// Upstream valid case: the unused-comment check runs per transition, and the
// last case has no next label — a marker before the switch's closing brace
// belongs to no transition, so even with the option on nothing may fire.
//
// 1. Put `break;` then a marker in the switch's only case.
// 2. Run the engine with options {"reportUnusedFallthroughComment":true}.
// 3. Assert zero findings.
func TestNoFallthroughUnusedCheckSkipsLastCaseMarker(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    break;
    // falls through
}
`, `{"reportUnusedFallthroughComment":true}`)
}
