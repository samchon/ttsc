package linthost

import "testing"

// TestNoFallthroughRejectsLabeledBlockBrokenByOwnLabel verifies `label: { break label; }` completes normally.
//
// A break targeting the labeled block resumes right after that block, still
// inside the case, so the transition falls through. Negative twin of the
// labeled-break-to-outer-loop acceptance: the same syntax, but the label sits
// inside the case instead of outside the switch. Locks the label-absorption
// rule of labeledCompletion.
//
// 1. End a case with a labeled block that breaks out of itself.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert exactly one finding at the next case label.
//
// @evidence contracts/testing.md#behavioral-verification Exactly one no-fallthrough error reports on target line seven after a self-targeted block break.
// @evidence contracts/testing.md#independent-expectations The authored label lies inside the case; leaving its block resumes before the next label rather than leaving the switch.
// @evidence contracts/testing.md#distinguishing-cases AcceptsLabeledBreakToOuterLoop targets beyond the switch and remains clean.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughRejectsLabeledBlockBrokenByOwnLabel is selected in the shared Go unit population and invokes assertNoFallthroughReportsAtLines and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughRejectsLabeledBlockBrokenByOwnLabel(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
switch (foo) {
  case 0:
    block: {
      break block;
    }
  case 1:
    console.log(1);
    break;
}
`, "", 7)
}
