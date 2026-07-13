package linthost

import "testing"

// TestNoFallthroughRejectsIfWithoutElse verifies an if with no else still falls through.
//
// Negative twin of the all-paths-terminate acceptance, one property away (the
// else branch removed): a false condition skips the whole if, so the case end
// stays reachable even though the then-branch breaks. Locks against treating
// "one branch exits" as termination (a forbidden shortcut in issue #411).
//
// 1. End a case with `if (a) { break; }` and no else.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert exactly one finding at the next case label.
func TestNoFallthroughRejectsIfWithoutElse(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
declare const a: boolean;
switch (foo) {
  case 0:
    if (a) {
      break;
    }
  case 1:
    console.log(1);
    break;
}
`, "", 8)
}
