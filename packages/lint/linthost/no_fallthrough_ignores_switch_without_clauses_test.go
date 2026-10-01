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
//
// @evidence contracts/testing.md#behavioral-verification An empty switch returns zero findings.
// @evidence contracts/testing.md#independent-expectations The authored clause list is empty, so no transition pair exists to inspect.
// @evidence contracts/testing.md#distinguishing-cases ReportsEachUnmarkedTransitionOnce supplies nonempty consecutive clause pairs with exact findings.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughIgnoresSwitchWithoutClauses is selected in the shared Go unit population and invokes assertNoFallthroughClean and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughIgnoresSwitchWithoutClauses(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
}
`, "")
}
