package linthost

import "testing"

// TestNoFallthroughRejectsBreakableConditionalWhile verifies a conditional while loop always offers normal completion.
//
// Upstream invalid case `case 0: while (a) { break; } default:`: the loop
// test may fail before the first iteration, so the case end is reachable no
// matter what the body does. Locks against treating a loop-ending break as a
// case-ending break.
//
// 1. End a case with `while (a) { break; }`.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert exactly one finding at the next case label.
func TestNoFallthroughRejectsBreakableConditionalWhile(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
declare const a: boolean;
switch (foo) {
  case 0:
    while (a) {
      break;
    }
  case 1:
    console.log(1);
    break;
}
`, "", 8)
}
