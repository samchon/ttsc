package linthost

import "testing"

// TestNoFallthroughRejectsIfElseWithOneOpenBranch verifies an if/else with one normally-completing branch still falls through.
//
// Negative twin of the all-paths-terminate acceptance, one property away (the
// else branch completes normally): control can reach the case end through the
// open branch, so the transition must report.
//
// 1. End a case with an if/else where only the then-branch returns.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert exactly one finding at the next case label.
func TestNoFallthroughRejectsIfElseWithOneOpenBranch(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
declare const a: boolean;
function f(): void {
  switch (foo) {
    case 0:
      if (a) {
        return;
      } else {
        console.log("open");
      }
    case 1:
      console.log(1);
  }
}
JSON.stringify(f);
`, "", 11)
}
