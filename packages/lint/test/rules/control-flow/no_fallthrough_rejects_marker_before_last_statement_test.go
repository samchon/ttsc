package linthost

import "testing"

// TestNoFallthroughRejectsMarkerBeforeLastStatement verifies a marker above the case's last statement does not suppress.
//
// The eligible trailing range starts after the case's final token; a
// `// falls through` that precedes another statement documents nothing about
// the transition. Locks against whole-case-text scanning (an explicitly
// forbidden shortcut in issue #411).
//
// 1. Place the marker between two statements of the falling-through case.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert exactly one finding at the next case label.
func TestNoFallthroughRejectsMarkerBeforeLastStatement(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    // falls through
    console.log("still runs");
  case 1:
    console.log(1);
    break;
}
`, "", 7)
}
