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
