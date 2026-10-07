package linthost

import "testing"

// TestNoFallthroughReportsUnusedCommentInsideSoleBlock verifies the unused-comment check covers the in-block marker position.
//
// Upstream invalid case: the marker sits before the sole block's closing
// brace — an eligible marker position — but the block ends in `break`, so
// the comment is unused. Locks that both marker positions feed the
// unused-comment branch, reporting at the in-block comment.
//
// 1. Put `break;` then the marker inside the case's sole block.
// 2. Run the engine with options {"reportUnusedFallthroughComment":true}.
// 3. Assert one finding at the in-block comment's line.
//
// @evidence contracts/testing.md#behavioral-verification One no-fallthrough error reports on original in-block marker line six after break.
// @evidence contracts/testing.md#independent-expectations The independently authored block break closes completion while its eligible final marker remains subject to the unused-marker option.
// @evidence contracts/testing.md#distinguishing-cases AcceptsMarkerInsideSoleBlockStatement keeps the same marker position on an open block.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughReportsUnusedCommentInsideSoleBlock is selected in the shared Go unit population and invokes lintNoFallthrough through the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughReportsUnusedCommentInsideSoleBlock(t *testing.T) {
  file, findings := lintNoFallthrough(t, `declare const foo: number;
switch (foo) {
  case 0: {
    console.log(0);
    break;
    // falls through
  }
  case 1:
    console.log(1);
}
`, `{"reportUnusedFallthroughComment":true}`)
  actual := normalizeRuleFindings(file, findings)
  if len(actual) != 1 || actual[0].Rule != "no-fallthrough" || actual[0].Severity != SeverityError || actual[0].Line != 6 {
    t.Fatalf("expected one finding at line 6, got %+v", actual)
  }
}
