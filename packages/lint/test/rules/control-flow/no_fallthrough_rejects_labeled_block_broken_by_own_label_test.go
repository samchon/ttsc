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
