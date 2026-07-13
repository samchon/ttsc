package linthost

import "testing"

// TestNoFallthroughReportsInnerAndOuterSwitchTransitions verifies a switch nested in a switch is checked independently.
//
// The engine dispatches every SwitchStatement node, so the inner switch's
// unmarked fallthrough reports at the inner default while the outer case —
// which completes normally through the inner switch — reports at the outer
// case. Locks per-switch pairing: transitions never pair across switch
// boundaries.
//
// 1. Nest a falling-through switch as an outer case's only statement.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert findings at the inner default and the outer next case.
func TestNoFallthroughReportsInnerAndOuterSwitchTransitions(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
declare const bar: number;
switch (foo) {
  case 0:
    switch (bar) {
      case 1:
        console.log(1);
      default:
        console.log(2);
    }
  case 1:
    console.log(3);
    break;
}
`, "", 8, 11)
}
