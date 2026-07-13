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
