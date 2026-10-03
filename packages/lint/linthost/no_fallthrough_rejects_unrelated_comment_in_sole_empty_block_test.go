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
//
// @evidence contracts/testing.md#behavioral-verification Exactly one no-fallthrough error reports on target line four for an unrelated sole-block comment.
// @evidence contracts/testing.md#independent-expectations An eligible comment position alone is insufficient; the independently authored wording does not match the default marker.
// @evidence contracts/testing.md#distinguishing-cases AcceptsMarkerInSoleEmptyBlock changes only comment text and stays clean.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughRejectsUnrelatedCommentInSoleEmptyBlock is selected in the shared Go unit population and invokes assertNoFallthroughReportsAtLines and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
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
