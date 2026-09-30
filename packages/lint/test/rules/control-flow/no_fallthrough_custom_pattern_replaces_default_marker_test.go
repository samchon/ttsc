package linthost

import "testing"

// TestNoFallthroughCustomPatternReplacesDefaultMarker verifies a custom commentPattern disables the default marker.
//
// ESLint compiles the custom pattern INSTEAD of the default one, so a
// standard `// falls through` stops being accepted once a project configures
// its own wording (upstream invalid regression). Negative twin of the
// custom-pattern acceptance, one property away (the comment text kept at the
// default spelling).
//
// 1. Mark the transition with `// falls through` under a custom pattern.
// 2. Run the engine with options {"commentPattern":"break omitted"}.
// 3. Assert exactly one finding at the next case label.
//
// @evidence contracts/testing.md#behavioral-verification Exactly one no-fallthrough error reports on original target line six under custom wording.
// @evidence contracts/testing.md#independent-expectations A configured commentPattern replaces the default falls-through pattern rather than extending it; the unchanged default-spelling comment independently fails the custom pattern.
// @evidence contracts/testing.md#distinguishing-cases HonorsCustomCommentPattern supplies matching custom text under the same option.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughCustomPatternReplacesDefaultMarker is selected in the shared Go unit population and invokes assertNoFallthroughReportsAtLines and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughCustomPatternReplacesDefaultMarker(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    // falls through
  case 1:
    console.log(1);
    break;
}
`, `{"commentPattern":"break omitted"}`, 6)
}
