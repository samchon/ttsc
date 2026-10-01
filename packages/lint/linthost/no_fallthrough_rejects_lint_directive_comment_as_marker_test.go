package linthost

import "testing"

// TestNoFallthroughRejectsLintDirectiveCommentAsMarker verifies the host's own lint-* directive family never counts as a marker.
//
// This host also recognizes `lint-enable` / `lint-disable*` comments as
// directives (directives.go), so they get the same exclusion as the eslint-*
// family: a directive naming no-fallthrough must not read as an intentional
// fallthrough. Locks the lint-* extension of noFallthroughDirectivePattern.
//
// 1. Put `// lint-enable no-fallthrough` in the trailing comment position.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert exactly one finding at the next case label.
//
// @evidence contracts/testing.md#behavioral-verification Exactly one no-fallthrough error reports on target line six despite lint-enable wording.
// @evidence contracts/testing.md#independent-expectations The host-specific lint directive family configures filtering rather than intentional fallthrough, even when naming this rule.
// @evidence contracts/testing.md#distinguishing-cases RejectsDirectiveCommentAsMarker retains the ESLint directive counterpart; suppression tests own actual disable behavior.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughRejectsLintDirectiveCommentAsMarker is selected in the shared Go unit population and invokes assertNoFallthroughReportsAtLines and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughRejectsLintDirectiveCommentAsMarker(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    // lint-enable no-fallthrough
  case 1:
    console.log(1);
    break;
}
`, "", 6)
}
