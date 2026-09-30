package linthost

import "testing"

// TestNoFallthroughAcceptsNestedSwitchTerminatingOnEveryPath verifies an exhaustive nested switch can terminate the outer case.
//
// The inner switch has a default clause, its final clause returns, and no
// break targets it, so control never comes back — the outer case end is
// unreachable. Locks the has-default / last-clause-completion join of
// switchCompletion.
//
// 1. End an outer case with a nested switch whose every path throws or returns.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Zero findings when the nested switch has default and every arm returns or throws.
// @evidence contracts/testing.md#independent-expectations The authored default prevents a no-match path and no inner break returns control to the outer case.
// @evidence contracts/testing.md#distinguishing-cases RejectsNestedSwitchWithoutDefault and RejectsNestedSwitchExitedByInnerBreak retain both reopening boundaries.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughAcceptsNestedSwitchTerminatingOnEveryPath is selected in the shared Go unit population and invokes assertNoFallthroughClean and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughAcceptsNestedSwitchTerminatingOnEveryPath(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
declare const bar: number;
function f(): void {
  switch (foo) {
    case 0:
      switch (bar) {
        case 1:
          throw new Error("one");
        default:
          return;
      }
    case 1:
      console.log(1);
  }
}
JSON.stringify(f);
`, "")
}
