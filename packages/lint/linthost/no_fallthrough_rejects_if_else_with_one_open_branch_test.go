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
//
// @evidence contracts/testing.md#behavioral-verification Exactly one no-fallthrough error reports on target line eleven with an open else branch.
// @evidence contracts/testing.md#independent-expectations Authored returning then and normally completing else paths independently leave one normal completion at the join.
// @evidence contracts/testing.md#distinguishing-cases AcceptsIfElseTerminatingEveryPath replaces the open branch with throw and stays clean.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughRejectsIfElseWithOneOpenBranch is selected in the shared Go unit population and invokes assertNoFallthroughReportsAtLines and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
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
