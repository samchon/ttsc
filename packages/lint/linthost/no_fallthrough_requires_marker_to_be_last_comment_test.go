package linthost

import "testing"

// TestNoFallthroughRequiresMarkerToBeLastComment verifies no-fallthrough only honors the last comment before the next case.
//
// ESLint tests getCommentsBefore(nextCase).pop(): when an unrelated comment
// follows the marker, the marker no longer speaks for the transition. Locks
// the last-comment-only selection against "any comment in range matches"
// over-matching.
//
// 1. Place `// falls through` followed by `// TODO: revisit` before the case.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert exactly one finding at the next case label.
//
// @evidence contracts/testing.md#behavioral-verification Exactly one no-fallthrough error reports on target line seven when unrelated trivia follows the marker.
// @evidence contracts/testing.md#independent-expectations The authored last comment before the next label is TODO rather than the marker; independently selecting any earlier comment would over-suppress.
// @evidence contracts/testing.md#distinguishing-cases AcceptsBlockMarkerWithTrailingUnrelatedComment retains the separate eligible sole-block interior position.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughRequiresMarkerToBeLastComment is selected in the shared Go unit population and invokes assertNoFallthroughReportsAtLines and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughRequiresMarkerToBeLastComment(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    // falls through
    // TODO: revisit
  case 1:
    console.log(1);
    break;
}
`, "", 7)
}
