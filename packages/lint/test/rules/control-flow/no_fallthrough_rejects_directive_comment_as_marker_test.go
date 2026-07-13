package linthost

import "testing"

// TestNoFallthroughRejectsDirectiveCommentAsMarker verifies an eslint directive comment never counts as a fallthrough marker.
//
// `// eslint-enable no-fallthrough` textually matches /falls?\s?through/i but
// is configuration, not documentation; upstream excludes directive-shaped
// comments via its shared directivesPattern (pinned by an ESLint regression
// test). Locks the directive-exclusion branch of isNoFallthroughMarker.
//
// 1. Put `// eslint-enable no-fallthrough` in the trailing comment position.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert exactly one finding at the next case label.
func TestNoFallthroughRejectsDirectiveCommentAsMarker(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    // eslint-enable no-fallthrough
  case 1:
    console.log(1);
    break;
}
`, "", 6)
}
