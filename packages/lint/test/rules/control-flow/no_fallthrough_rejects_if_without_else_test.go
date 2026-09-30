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
//
// @evidence contracts/testing.md#behavioral-verification Exactly one no-fallthrough error reports on target line eight for an if without else.
// @evidence contracts/testing.md#independent-expectations The authored condition may be false; a then-only break cannot close that bypass path.
// @evidence contracts/testing.md#distinguishing-cases AcceptsIfElseTerminatingEveryPath supplies the exhaustive abrupt-branch twin.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughRejectsIfWithoutElse is selected in the shared Go unit population and invokes assertNoFallthroughReportsAtLines and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
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
