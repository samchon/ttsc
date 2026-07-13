package linthost

import "testing"

// TestNoFallthroughRejectsUnrelatedTrailingComment verifies no-fallthrough still reports when the trailing comment is not a marker.
//
// Negative twin of the marked-fallthrough acceptance: a comment sits in the
// eligible trailing position but does not match the marker pattern, so the
// transition must report. Locks against "any comment suppresses" over-matching.
//
// 1. Build a fallthrough whose trailing comment reads `// keep going`.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert exactly one finding at the next case label.
func TestNoFallthroughRejectsUnrelatedTrailingComment(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    // keep going
  case 1:
    console.log(1);
    break;
}
`, "", 6)
}
