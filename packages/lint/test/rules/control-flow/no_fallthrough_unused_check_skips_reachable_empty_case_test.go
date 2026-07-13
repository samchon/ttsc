package linthost

import "testing"

// TestNoFallthroughUnusedCheckSkipsReachableEmptyCase verifies an empty case's marker is not reported as unused.
//
// An adjacent empty case genuinely falls through (its end is reachable), it
// is merely exempt from the fallthrough report — so a marker on it is
// documentation of real behavior, not an unused comment. Locks that the
// unused branch tests reachability (!endReachable), not the fallthrough
// verdict (!fallsThrough).
//
// 1. Put a marker on an empty case directly above the next label.
// 2. Run the engine with options {"reportUnusedFallthroughComment":true}.
// 3. Assert zero findings.
func TestNoFallthroughUnusedCheckSkipsReachableEmptyCase(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0: // falls through
  case 1:
    console.log(1);
    break;
}
`, `{"reportUnusedFallthroughComment":true}`)
}
