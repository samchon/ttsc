package linthost

import "testing"

// TestNoFallthroughRejectsMarkerInBlockThatIsNotSoleStatement verifies the in-block marker position requires the block to be the only statement.
//
// ESLint applies the block-interior check only when the case body is exactly
// one block statement. A marker inside a block that follows another statement
// is not in an eligible position and must not suppress. Negative twin of the
// sole-block acceptance, one property away (an extra preceding statement).
//
// 1. Put `console.log(0);` then a block containing only the marker comment.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert exactly one finding at the next case label.
//
// @evidence contracts/testing.md#behavioral-verification Exactly one no-fallthrough error reports on target line six when a preceding statement makes the marked block non-sole.
// @evidence contracts/testing.md#independent-expectations The block-interior exemption requires the whole case body to be that block; the authored extra statement defeats that ownership.
// @evidence contracts/testing.md#distinguishing-cases AcceptsMarkerInSoleEmptyBlock preserves identical block-contained wording without the extra statement.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughRejectsMarkerInBlockThatIsNotSoleStatement is selected in the shared Go unit population and invokes assertNoFallthroughReportsAtLines and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughRejectsMarkerInBlockThatIsNotSoleStatement(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    { /* falls through */ }
  case 1:
    console.log(1);
    break;
}
`, "", 6)
}
