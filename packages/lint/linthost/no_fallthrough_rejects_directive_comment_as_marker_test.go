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
//
// @evidence contracts/testing.md#behavioral-verification Exactly one no-fallthrough error reports on target line six despite eslint-enable text.
// @evidence contracts/testing.md#independent-expectations An enable directive configures suppression rather than documenting intentional transition; its rule-name substring independently must not become a marker.
// @evidence contracts/testing.md#distinguishing-cases DirectiveSuppressionStillWins keeps the actual disable-next-line operation functional.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughRejectsDirectiveCommentAsMarker is selected in the shared Go unit population and invokes assertNoFallthroughReportsAtLines and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
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
