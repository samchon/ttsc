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
