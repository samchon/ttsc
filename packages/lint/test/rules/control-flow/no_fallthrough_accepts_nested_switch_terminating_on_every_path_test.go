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
