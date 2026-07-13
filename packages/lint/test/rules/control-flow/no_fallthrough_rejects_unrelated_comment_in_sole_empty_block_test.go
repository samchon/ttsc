package linthost

import "testing"

// TestNoFallthroughRejectsUnrelatedCommentInSoleEmptyBlock verifies a non-marker comment in an empty sole block does not suppress.
//
// Upstream invalid case `case 0: { /* comment */ } default: b();`: the empty
// block completes normally so the case falls through, and the in-block
// comment does not match the marker pattern. Negative twin of the
// empty-block marker acceptance, one property away (the comment text).
//
// 1. Make the case body a sole empty block containing an unrelated comment.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert exactly one finding at the next case label.
func TestNoFallthroughRejectsUnrelatedCommentInSoleEmptyBlock(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
switch (foo) {
  case 0: { /* comment */ }
  case 1:
    console.log(1);
    break;
}
`, "", 4)
}
