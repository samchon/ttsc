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
//
// @evidence contracts/testing.md#behavioral-verification Zero findings report for an adjacent empty label carrying a marker under unused checking.
// @evidence contracts/testing.md#independent-expectations The authored empty case really reaches its neighbor while exempt from the ordinary warning; exemption is distinct from unreachable completion.
// @evidence contracts/testing.md#distinguishing-cases ReportsUnusedFallthroughComment retains a genuinely closed case whose marker is unused.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughUnusedCheckSkipsReachableEmptyCase is selected in the shared Go unit population and invokes assertNoFallthroughClean and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
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
