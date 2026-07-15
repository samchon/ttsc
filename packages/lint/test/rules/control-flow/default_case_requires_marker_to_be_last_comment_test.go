package linthost

import "testing"

// TestDefaultCaseRequiresMarkerToBeLastComment verifies only the last trailing comment counts as the marker.
//
// ESLint tests getCommentsAfter(lastCase).at(-1): when an unrelated comment
// follows the marker, the marker no longer speaks for the switch. Locks the
// last-comment-only selection against an "any comment in range matches"
// over-match.
//
// 1. Place `// no default` followed by `// revisit later` after the last clause.
// 2. Run the engine with default-case enabled.
// 3. Assert exactly one finding at the switch statement (line 2).
func TestDefaultCaseRequiresMarkerToBeLastComment(t *testing.T) {
  assertDefaultCaseReportsAtLines(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    break;
  // no default
  // revisit later
}
`, "", 2)
}
