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
//
// @evidence contracts/testing.md#behavioral-verification The in-process check reports no transition for both originally marked catch paths.
// @evidence contracts/testing.md#independent-expectations A valid trailing marker permits an open catch path and stays silent after a closed path when unused-marker reporting is disabled.
// @evidence contracts/testing.md#distinguishing-cases The original bare-return/explicit-throw pair exercises unreachable and reachable catches with the same marker.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughCommandPreservesMarkersAcrossCatchReachability is selected in the shared Go unit population and invokes assertNoFallthroughCommandMarkers and run(check) with the actual Program. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
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
