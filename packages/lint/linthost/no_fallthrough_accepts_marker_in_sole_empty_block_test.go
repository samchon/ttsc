package linthost

import "testing"

// TestNoFallthroughAcceptsMarkerInSoleEmptyBlock verifies a marker inside an empty sole block suppresses the transition.
//
// Upstream valid case `case 0: { /* falls through */ } case 1: b();`: the
// block has no statements, so the eligible in-block region starts right after
// the opening brace. Locks the empty-block branch of blockInteriorStart,
// which computes the region start from the `{` token instead of a last
// statement.
//
// 1. Make the case body a sole empty block containing only the marker.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Zero findings for a sole empty block containing a falls-through marker.
// @evidence contracts/testing.md#independent-expectations The empty block's opening-brace trivia contains the eligible marker even with no preceding statement.
// @evidence contracts/testing.md#distinguishing-cases RejectsUnrelatedCommentInSoleEmptyBlock changes only the comment and reports.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughAcceptsMarkerInSoleEmptyBlock is selected in the shared Go unit population and invokes assertNoFallthroughClean and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughAcceptsMarkerInSoleEmptyBlock(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0: { /* falls through */ }
  case 1:
    console.log(1);
    break;
}
`, "")
}
