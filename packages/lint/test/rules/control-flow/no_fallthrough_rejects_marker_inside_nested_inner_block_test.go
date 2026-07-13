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
