package linthost

import "testing"

// TestNoFallthroughIgnoresSwitchWithoutClauses verifies an empty switch body produces nothing.
//
// `switch (foo) { }` has no clause pairs to examine; the rule must return
// silently instead of tripping over an empty clause list (upstream valid
// case). Locks the boundary condition of the transition loop.
//
// 1. Build a switch with an empty case block.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
func TestNoFallthroughIgnoresSwitchWithoutClauses(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
}
`, "")
}
