package linthost

import "testing"

// TestNoFallthroughRejectsMarkerInsideNestedInnerBlock verifies the in-block marker must sit directly before the outer block's closing brace.
//
// ESLint reads the comments between the block's last token and its own
// closing brace. A marker buried one block deeper belongs to the inner brace
// and must not suppress (upstream regression:
// `case 0: { { /* falls through */ } } default:`).
//
// 1. Nest the marker inside an inner block within the sole outer block.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert exactly one finding at the next case label.
//
// @evidence contracts/testing.md#behavioral-verification Exactly one no-fallthrough error reports on target line six for an inner-block marker.
// @evidence contracts/testing.md#independent-expectations The authored marker belongs to a nested closing brace, not to the sole outer block's final trivia position.
// @evidence contracts/testing.md#distinguishing-cases AcceptsMarkerInsideSoleBlockStatement retains the directly eligible block marker.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughRejectsMarkerInsideNestedInnerBlock is selected in the shared Go unit population and invokes assertNoFallthroughReportsAtLines and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughRejectsMarkerInsideNestedInnerBlock(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
switch (foo) {
  case 0: {
    { /* falls through */ }
  }
  case 1:
    console.log(1);
    break;
}
`, "", 6)
}
