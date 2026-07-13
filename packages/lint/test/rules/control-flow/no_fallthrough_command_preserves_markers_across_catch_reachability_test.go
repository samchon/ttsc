package linthost

import "testing"

// TestNoFallthroughCommandPreservesMarkersAcrossCatchReachability verifies
// marker recognition is unchanged when catch reachability changes. A marker is
// harmless after an unreachable catch and still suppresses a real fallthrough
// from a reachable, normally completing catch.
//
// 1. Mark transitions after a bare return and after an explicit throw.
// 2. Let both catches complete normally.
// 3. Assert the real command reports neither transition.
func TestNoFallthroughCommandPreservesMarkersAcrossCatchReachability(t *testing.T) {
  assertNoFallthroughCommandMarkers(t, `function inspect(value: number): unknown {
  switch (value) {
    case 0:
      try {
        return;
      } catch {}
      // falls through
    case 1:
      break;
    case 2:
      try {
        throw 0;
      } catch {}
      // falls through
    case 3:
      break;
  }
}

inspect(0);
`)
}
