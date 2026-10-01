package linthost

import "testing"

// TestNoFallthroughAcceptsMarkerInsideSoleBlockStatement verifies no-fallthrough honors a marker before a sole block's closing brace.
//
// ESLint's second eligible marker position: when the case body is exactly one
// block statement, the last comment before that block's closing brace marks
// the transition. Locks the block-interior branch of
// noFallthroughMarkerComment.
//
// 1. Wrap the case body in a single block whose last line is the marker.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Zero findings for a marker immediately inside the sole case block's closing brace.
// @evidence contracts/testing.md#independent-expectations A sole-block final trivia marker is an independently supported position, unlike a marker nested in another block.
// @evidence contracts/testing.md#distinguishing-cases RejectsMarkerInsideNestedInnerBlock and RejectsMarkerInBlockThatIsNotSoleStatement own both position boundaries.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughAcceptsMarkerInsideSoleBlockStatement is selected in the shared Go unit population and invokes assertNoFallthroughClean and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughAcceptsMarkerInsideSoleBlockStatement(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0: {
    console.log(0);
    // falls through
  }
  case 1:
    console.log(1);
    break;
}
`, "")
}
