package linthost

import "testing"

// TestNoFallthroughRejectsNestedSwitchExitedByInnerBreak verifies an inner break targets the inner switch, not the outer one.
//
// `switch (bar) { default: break; }` completes normally — the break merely
// exits the inner switch — so the outer case still falls through. If the
// inner break leaked outward it would wrongly terminate the outer case and
// hide the report. Locks the unlabeled-break absorption of switchCompletion.
//
// 1. End an outer case with a nested switch whose default clause breaks.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert exactly one finding at the outer next-case label.
func TestNoFallthroughRejectsNestedSwitchExitedByInnerBreak(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
declare const bar: number;
switch (foo) {
  case 0:
    switch (bar) {
      default:
        break;
    }
  case 1:
    console.log(1);
    break;
}
`, "", 9)
}
