package linthost

import "testing"

// TestNoFallthroughRejectsEmptyCaseWithCommentLineGap verifies a comment on its own line still counts as a blank-line gap.
//
// Upstream invalid case `case 0: \n /* with comments */ \ncase 1:`: the
// blank-line check compares the case end to the next TOKEN, skipping
// comments — a comment-only line widens the gap exactly like a blank line.
// Negative twin of the same-line-comment acceptance, one property away (the
// comment moved to its own line).
//
// 1. Put an unrelated comment on its own line between the empty case and the next label.
// 2. Run the engine with no-fallthrough enabled and default options.
// 3. Assert exactly one finding at the next case label.
func TestNoFallthroughRejectsEmptyCaseWithCommentLineGap(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
switch (foo) {
  case 0:
    /* with comments */
  case 1:
    console.log(1);
    break;
}
`, "", 5)
}
