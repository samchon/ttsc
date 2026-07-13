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
